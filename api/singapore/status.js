const { getStatus } = require('../../lib/singapore-playlist');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  res.status(200).json(getStatus(process.cwd()));
};
