const { getStatus } = require('../../lib/singapore-playlist');
const { getPlaybackStatus } = require('../../lib/vercel-playlist');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (process.env.VERCEL) {
    return res.status(200).json(getPlaybackStatus());
  }

  const status = getStatus(process.cwd());
  if (!status.available) {
    return res.status(200).json(getPlaybackStatus());
  }
  res.status(200).json(status);
};
