
# HLS Server

Welcome to the **HLS Server** This project provides a simple and efficient way to upload videos, convert them to HLS (HTTP Live Streaming) format using FFmpeg, and stream them through a web-based media player. This README will guide you through setting up and running the HLS Server.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Running the Server](#running-the-server)
6. [Using the Application](#using-the-application)
    - [a. Uploading a Video](#a-uploading-a-video)
    - [b. Accessing the Media Player](#b-accessing-the-media-player)
7. [Directory Structure](#directory-structure)

---

## Overview

The HLS Server allows users to:

- **Upload Videos**: Users can upload video files through a web interface.
- **Convert Videos to HLS**: Uploaded videos are processed using FFmpeg to generate HLS-compatible segments.
- **Stream Videos**: Processed videos can be streamed through a web-based media player that supports HLS playback.

---

## Features

- **Video Upload**: Seamless uploading of video files via a web form.
- **FFmpeg Integration**: Automatic conversion of uploaded videos to HLS format.
- **HLS Streaming**: Serve HLS segments and playlists for smooth video streaming.
- **Media Player**: Web-based player utilizing `hls.js` for playback in browsers that do not natively support HLS.

---

## Prerequisites

Before setting up the HLS Server, ensure you have the following installed on your machine:

1. **Node.js (v14 or later)**: JavaScript runtime.
2. **npm**: Node package manager (comes with Node.js).
3. **FFmpeg**: Multimedia framework for processing video files.
4. **Git**: Version control system (optional, for cloning the repository).

### Installing FFmpeg on macOS

If you're using macOS, you can install FFmpeg via Homebrew:

```bash
brew install ffmpeg
```

Verify the installation:

```bash
ffmpeg -version
```

---

## Installation

Follow these steps to set up the project locally.

### 1. Clone the Repository

If you haven't already, clone the repository to your local machine:

```bash
git clone git@github.com:zdaraoui2/hls-server.git
cd hls-server
```

### 2. Install Dependencies

Install the necessary Node.js packages using npm:

```bash
npm install
```

---

## Running the Server

Start the server using the following command:

```bash
node server.js
```

Upon successful startup, you should see the following message in your terminal:

```
Server is running on http://localhost:3000
```

---

## Using the Application

### a. Uploading a Video

1. **Open the Upload Page**
   Navigate to [http://localhost:3000/](http://localhost:3000/) in your web browser.

2. **Select and Upload a Video**
   - Click on the "Choose File" button to select a video file from your computer.
   - Click the "Upload" button to start uploading.

### b. Accessing the Media Player

1. **Navigate to the Player**
   Go to [http://localhost:3000/player.html](http://localhost:3000/player.html).

2. **Select the Uploaded Video**
   Choose the video you just uploaded from the dropdown menu.

3. **Play the Video**
   Click the **Load Video** button. The video should start playing.

---

## Directory Structure

```
hls-server/
├── hls/
│   ├── <videoName>/
│   └── ...
├── public/
│   ├── index.html
│   └── player.html
├── uploads/
│   └── <uploaded video files>
├── server.js
├── package.json
└── .gitignore
```