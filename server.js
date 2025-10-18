const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Simplified downloader using yt-dlp command (we'll install it in Railway)
async function downloadVideo(url, platform) {
  return new Promise((resolve, reject) => {
    const outputPath = `/tmp/video_${Date.now()}.mp4`;
    
    let command;
    
    if (platform === 'youtube') {
      // Use yt-dlp for YouTube
      command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputPath}" "${url}"`;
    } else if (platform === 'tiktok') {
      // Use yt-dlp for TikTok (it supports TikTok too)
      command = `yt-dlp -o "${outputPath}" "${url}"`;
    } else {
      return reject(new Error(`Platform ${platform} not yet supported`));
    }
    
    console.log(`Running: ${command}`);
    
    exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Download error:', stderr);
        return reject(new Error(`Download failed: ${error.message}`));
      }
      
      // Read the downloaded file
      fs.readFile(outputPath, (err, data) => {
        // Clean up
        fs.unlink(outputPath, () => {});
        
        if (err) {
          return reject(new Error(`Failed to read file: ${err.message}`));
        }
        
        resolve(data);
      });
    });
  });
}

app.post('/download', async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log(`📥 Downloading from ${platform}: ${url}`);
    
    const videoBuffer = await downloadVideo(url, platform);
    
    // Return video as base64
    const base64Video = videoBuffer.toString('base64');
    
    res.json({
      success: true,
      video: base64Video,
      size: videoBuffer.length,
      platform: platform
    });
    
    console.log(`✅ Download complete! Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    
  } catch (error) {
    console.error('❌ Download error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Video Downloader API is running!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
