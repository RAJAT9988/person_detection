const { discoverPlaylist } = require('../../lib/singapore-playlist');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  const videos = discoverPlaylist(process.cwd());
  if (!videos.length) {
    return res.status(404).json({
      error: 'No processed videos found. Run: cd singapor && python3 process_video.py --force',
    });
  }
  res.status(200).json({ version: 1, loop: true, videos });
};
