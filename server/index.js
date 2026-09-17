const express = require('express');
const path = require('path');

const sleeperRoutes = require('./routes/sleeper');
const rankingsRoutes = require('./routes/rankings');
const tradeValuesRoutes = require('./routes/tradeValues');
const tradeRoutes = require('./routes/trade');
const startersRoutes = require('./routes/starters');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/sleeper', sleeperRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/tradevalues', tradeValuesRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/starters', startersRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`FF-Hub running at http://localhost:${PORT}`);
});
