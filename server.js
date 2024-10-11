import { dirname } from 'path';
import { exec } from 'child_process';
import express from 'express';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import serveIndex from 'serve-index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
  // Use a unique filename to prevent conflicts
      fs.readdir(uploadDir, (err, files) => {
        if (err) {
          return cb(err);
        }
  
        // Filter files that match video-1, video-2 etc pattern
        const videoFiles = files.filter(
          (f) => f.startsWith('video-') && path.extname(f) === path.extname(file.originalname)
        );
  
        // Extract numbers from filenames
        const videoNumbers = videoFiles.map((f) => {
          const match = f.match(/video-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
  
        // Find the next available number
        const nextNumber = videoNumbers.length > 0 ? Math.max(...videoNumbers) + 1 : 1;
  
        // Assign filename
        cb(null, `video${nextNumber}${path.extname(file.originalname)}`);
      });
    },
  });
  
  const upload = multer({ storage: storage });
// Ensure upload and hls directories exist
const uploadDir = path.join(__dirname, 'uploads');
const hlsDir = path.join(__dirname, 'hls');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir, { recursive: true });
}

// Serve static files from hls and enable directory listing
app.use('/hls', express.static(hlsDir), serveIndex(hlsDir, { icons: true }));

// Serve static html files
app.use(express.static(path.join(__dirname, 'public')));

// Video upload form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// List of available videos
app.get('/videos', (req, res) => {
  fs.readdir(hlsDir, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error('Error reading hls directory:', err);
      return res.status(500).json({ error: 'Failed to list videos' });
    }

    const videos = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    res.json({ videos });
  });
});

function getVideoInfo(inputPath, callback) {
  // Get video resolution
  exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${inputPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`FFprobe error (video): ${stderr}`);
        return callback(`FFprobe error: ${stderr}`, null);
      }
      const [width, height] = stdout.trim().split('x').map(Number);

      // Get audio streams
      exec(`ffprobe -v error -select_streams a -show_entries stream=index,codec_type,codec_name -of json "${inputPath}"`, (error2, stdout2, stderr2) => {
          if (error2) {
            console.error(`FFprobe error (audio): ${stderr2}`);
            return callback(`FFprobe error: ${stderr2}`, null);
          }
          let audioInfo;
          try {
            audioInfo = JSON.parse(stdout2).streams;
          } catch (parseError) {
            console.error('Error parsing FFprobe audio output:', parseError);
            return callback('Error parsing FFprobe audio output', null);
          }

          callback(null, { width, height, audioStreams: audioInfo });
        }
      );
    }
  );
}

// Upload video
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No video file uploaded.');
  }

  const inputPath = req.file.path;
  const videoName = path.parse(req.file.filename).name;
  const outputDir = path.join(hlsDir, videoName);
  const masterPlaylistPath = path.join(outputDir, 'master.m3u8');

  fs.mkdirSync(outputDir, { recursive: true });

  // Get video information
  getVideoInfo(inputPath, (err, info) => {
    if (err) {
      console.error('Error getting video info:', err);
      return res.status(500).send(`Error processing video: ${err}`);
    }

    const { width, height, audioStreams } = info;

    // Define desired resolutions
    const desiredResolutions = [
      { label: '1080', width: 1920, height: 1080, bitrate: '5000k', maxrate: '5350k', bufsize: '7500k', bandwidth: 5000000,
      },
      { label: '720', width: 1280, height: 720, bitrate: '2800k', maxrate: '2996k', bufsize: '4200k', bandwidth: 2800000,
      },
      { label: '480', width: 854, height: 480, bitrate: '1400k', maxrate: '1498k', bufsize: '2100k', bandwidth: 1400000,
      },
      { label: '360', width: 640, height: 360, bitrate: '800k', maxrate: '856k', bufsize: '1200k', bandwidth: 800000,
      },
    ];

    // Filter resolutions
    const availableResolutions = desiredResolutions.filter(res => res.width <= width && res.height <= height);

    if (availableResolutions.length === 0) {
      return res.status(400).send('Input video resolution is too low for any HLS variants.');
    }

    // Select the first compatible audio stream
    const selectedAudioStream = audioStreams.find(a => a.codec_name === 'aac' || a.codec_name === 'mp3');
    if (!selectedAudioStream) {
      return res.status(400).send('No compatible audio streams found in the input video. Please ensure the audio is in AAC or MP3 format.');
    }

    const selectedAudioStreamIndex = selectedAudioStream.index;

    console.log(`Selected Audio Stream Index: ${selectedAudioStreamIndex} (Codec: ${selectedAudioStream.codec_name})`);

    const filterComplexParts = [];
    availableResolutions.forEach((res, index) => {
      filterComplexParts.push(`[0:v]scale=w=${res.width}:h=${res.height}[v${index}]`);
    });
    const filterComplex = filterComplexParts.join('; ');

    const perVariantOutputs = [];
    availableResolutions.forEach((res, index) => {
      const qualityDir = path.join(outputDir, res.label);
      fs.mkdirSync(qualityDir, { recursive: true });

      const segmentFilename = `${qualityDir}/segment_%d_${res.label}.ts`;
      
      const playlistFilename = `${qualityDir}/index_${res.label}.m3u8`;

      const outputOptions = `-map "[v${index}]" -map 0:${selectedAudioStreamIndex} -c:v libx264 -b:v ${res.bitrate} -maxrate ${res.maxrate} -bufsize ${res.bufsize} -c:a aac -b:a 128k -f hls -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${segmentFilename}" "${playlistFilename}"`;

      perVariantOutputs.push(outputOptions);
    });

    // Construct FFmpeg command
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -filter_complex "${filterComplex}" ${perVariantOutputs.join(' ')}`;

    console.log('Executing FFmpeg command:', ffmpegCommand);

    // Execute FFmpeg command
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`FFmpeg error: ${error.message}`);
        console.error(`FFmpeg stderr: ${stderr}`);
        return res.status(500).send(`Error processing video: ${stderr}`);
      }
      console.log(`FFmpeg output: ${stdout}`);
      console.error(`FFmpeg stderr: ${stderr}`);

      // Generate master playlist
      generateMasterPlaylist(outputDir, availableResolutions, (err) => {
        if (err) {
          console.error('Error creating master playlist:', err);
          return res.status(500).send('Error creating master playlist.');
        }

        res.send(
          `Video uploaded and processed successfully. Access it <a href="/player.html?video=${videoName}/master.m3u8">here</a>.`
        );
      });
    });
  });
});

// Function to generate the master playlist
function generateMasterPlaylist(outputDir, availableResolutions, callback) {
  let content = '#EXTM3U\n';

  availableResolutions.forEach((res) => {
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${res.bandwidth},RESOLUTION=${res.width}x${res.height}\n`;
    content += `${res.label}/index_${res.label}.m3u8\n`;
  });

  fs.writeFile(path.join(outputDir, 'master.m3u8'), content, callback);
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
