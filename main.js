const http = require('http');
const { Command } = require('commander');
const fs = require('fs/promises');
const path = require('path');
const { create } = require('xmlbuilder2');

// Налаштування CLI через commander
const program = new Command();

program
  .requiredOption('-h, --host <type>', 'Server host address')
  .requiredOption('-p, --port <type>', 'Server port')
  .requiredOption('-i, --input <type>', 'Input JSON file path')
  .parse(process.argv);

const options = program.opts();
const host = options.host;
const port = parseInt(options.port, 10);
const inputFilePath = path.resolve(options.input);

if (isNaN(port)) {
  console.error('Error: Port must be a number.');
  process.exit(1);
}

// Обробка HTTP-запиту
const requestHandler = async (req, res) => {
  try {
    // Читаємо JSON файл
    const jsonData = await fs.readFile(inputFilePath, 'utf-8');
    const data = JSON.parse(jsonData);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid JSON format: expected non-empty array.');
    }

    let minValue = Infinity;
    let minObject = null;

    for (const item of data) {
      if (typeof item.value === 'number' && item.value < minValue) {
        minValue = item.value;
        minObject = item;
      } else if (item.value === undefined || typeof item.value !== 'number') {
        console.warn('Skipping item with invalid value:', item);
      }
    }

    if (minValue === Infinity) {
      throw new Error('No valid numeric "value" field found.');
    }

    // Формування XML
    const xml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('data')
      .ele('min_value')
      .txt(minValue.toString())
      .up()
      .end({ prettyPrint: true });

    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(xml);
  } catch (error) {
    console.error('Error processing request:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
};

// Функція запуску сервера
function startServer() {
  const server = http.createServer(requestHandler);

  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}/`);
    console.log(`Reading data from: ${inputFilePath}`);
    console.log('Waiting for requests...');
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
    }
    process.exit(1);
  });
}

// Перевірка файлу перед запуском
async function checkFileAndStartServer() {
  try {
    await fs.access(inputFilePath, fs.constants.R_OK);
    console.log(`Input file found: ${inputFilePath}`);
    startServer();
  } catch (err) {
    console.error(`Error: Cannot find input file "${options.input}".`);
    console.error('Detailed error:', err.message);
    process.exit(1);
  }
}

checkFileAndStartServer();