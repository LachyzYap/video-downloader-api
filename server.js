const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const https = require('https');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Helper function to download from direct URL
function downloadFromUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFromUrl(response.headers.location).then(resolve).catch(reject);
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
  });
}

// TikTok downloader
async function downloadTikTok(url) {
  try {
    // For TikTok, we'll use a simple approach with TikTok's API
    const videoId = url.match(/video\/(\d+)/)?.[1];
    if (!videoId) throw new Error('Invalid TikTok URL');
    
    // This is a simplified version - you may need to use TikTok API or scraping
    const response = await fetch(`https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`);
    const data = await response.json();
    
    if (!data.aweme_list || !data.aweme_list[0]) {
      throw new Error('Video not found');
    }
    
    const videoUrl = data.aweme_list[0].video.play_addr.url_list[0];
    const buffer = await downloadFromUrl(videoUrl);
    
    return buffer;
  } catch (error) {
    throw new Error(`TikTok download failed: ${error.message}`);
  }
}

// YouTube downloader using ytdl-core
async function downloadYouTube(url) {
  try {
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' });
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      ytdl(url, { format: format })
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject);
    });
  } catch (error) {
    throw new Error(`YouTube download failed: ${error.message}`);
  }
}

// Main download endpoint
app.post('/download', async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log(`📥 Downloading from ${platform}: ${url}`);
    
    let videoBuffer;
    
    switch (platform) {
      case 'youtube':
        videoBuffer = await downloadYouTube(url);
        break;
      case 'tiktok':
        videoBuffer = await downloadTikTok(url);
        break;
      case 'instagram':
        // Instagram requires more complex handling - we'll add this later
        return res.status(501).json({ error: 'Instagram support coming soon' });
      case 'googledrive':
        // Google Drive requires OAuth - we'll add this later
        return res.status(501).json({ error: 'Google Drive support coming soon' });
      default:
        return res.status(400).json({ error: 'Unsupported platform' });
    }
    
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
