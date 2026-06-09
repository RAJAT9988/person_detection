const { discoverPlaylist } = require('../../lib/singapore-playlist');
const { getPlaybackPlaylist } = require('../../lib/vercel-playlist');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (process.env.VERCEL) {
    return res.status(200).json(getPlaybackPlaylist());
  }

  const videos = discoverPlaylist(process.cwd());
  if (!videos.length) {
    return res.status(200).json(getPlaybackPlaylist());
  }
  res.status(200).json({ version: 1, loop: true, mode: 'detection', videos });
};
