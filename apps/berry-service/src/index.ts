import express from 'express';
import { createBatch } from './commands/createBatch';
import { getBatchEvents } from './queries/getBatchEvents';

const app = express();
const port = process.env.PORT || 3001;

// Middleware para parsear JSON, esencial para el endpoint POST.
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Berry service is running!');
});

// Endpoint para crear un nuevo batch (registra un evento).
app.post('/batch', async (req, res) => {
  try {
    // Se asume que el body contiene al menos un 'batchId'.
    if (!req.body || !req.body.batchId) {
      return res.status(400).json({ error: 'batchId is required in the request body.' });
    }
    const event = await createBatch(req.body);
    res.status(201).json(event);
  } catch (err: any) {
    console.error('Error creating batch:', err);
    res.status(500).json({ error: 'Failed to create batch event.' });
  }
});

// Endpoint para obtener todos los eventos de un batch específico.
app.get('/batch/:batchId/events', async (req, res) => {
  try {
    const events = await getBatchEvents(req.params.batchId);
    if (events.length === 0) {
      return res.status(404).json({ message: 'No events found for this batchId.' });
    }
    res.json(events);
  } catch (err: any) {
    console.error('Error getting batch events:', err);
    res.status(500).json({ error: 'Failed to get batch events.' });
  }
});


app.listen(port, () => {
  console.log(`Berry service running on http://localhost:${port}`);
});
