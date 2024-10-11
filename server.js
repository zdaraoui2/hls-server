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
    cb(null, path.join(__dirname, 'uploads/'));
  },
  filename: function (req, file, cb) {
    // Use a unique filename to prevent conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Ensure upload and hls directories exist
const uploadDir = path.join(__dirname, 'uploads');
const hlsDir = path.join(__dirname, 'hls');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir);
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

// Upload video
app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No video file uploaded.');
    }

    const inputPath = req.file.path;
    const videoName = path.parse(req.file.filename).name;
    const outputDir = path.join(hlsDir, videoName);
    const outputPath = path.join(outputDir, 'output.m3u8');

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // FFmpeg command to convert video to HLS
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls "${outputPath}"`;

    exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`FFmpeg error: ${error.message}`);
            console.error(`FFmpeg stderr: ${stderr}`);
            return res.status(500).send('Error processing video.');
        }
        console.log(`FFmpeg output: ${stdout}`);
        console.error(`FFmpeg stderr: ${stderr}`);
        res.send(`Video uploaded and processed successfully. Access it <a href="/player.html?video=${videoName}">here</a>.`);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
