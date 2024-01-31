const pkg = require('pg');
const pgvector = require('pgvector/pg');
const fs = require('fs');
const path = require('path');
const { parseFile } = require('@fast-csv/parse');

const filePath = 'animes.csv';

const { Client } = pkg
const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
})
const df = [];

function read_data(path, options, row_formatter) {
    return new Promise((resolve, reject) => {
        const data = [];

        parseFile(path, options)
            .on("error", reject)
            .on("data", (row) => {
                const obj = row_formatter(row);
                if (obj) data.push(obj);
            })
            .on("end", (rowCount) => {
                console.log(`Parsed ${rowCount} items`);
                resolve(data);
            });
    });
}


async function load_main_data() {
    if (fs.existsSync(path.resolve(__dirname, filePath))) {
        console.log('File already created');
        try {
            if (df.length === 0) {
                await read_data(filePath, { headers: true }, row => df.push({ ...row, embedding: row.embedding.split(',').map(Number) }))
                console.log('Records loaded')
            }
        } catch (e) {
            console.log('There was a problem reading a saving data', e)
        }
        return;
    }
    console.log('File does not exist yet')
}
async function save_records_db() {
    await client.connect()
    await pgvector.registerType(client);
    await client.query('CREATE TABLE IF NOT EXISTS animes (id bigserial PRIMARY KEY, title text, description_small text, genere text, description_big text, embedding vector(1536))');
    for (let row of df) {
        await client.query('INSERT INTO animes (title, description_small, genere, description_big, embedding) VALUES ($1, $2, $3, $4, $5)', [row.title, row.description_small, row.genere, row.description_big, pgvector.toSql(row.embedding)]);
    }
    await client.end();
}

async function check_records() {
    await client.connect()
    await pgvector.registerType(client);
    const result = await client.query('SELECT * FROM animes LIMIT 2');
    console.log('result vector', result)
    await client.end();
}

async function execute_program() {
    await load_main_data();
    if (program_params.hasOwnProperty('savedb')) {
        await save_records_db();
        console.log('Records loaded to DB')
    }
    if (program_params.hasOwnProperty('check')) {
        await check_records();
    }
}

let program_params = {}
process.argv.forEach(function (val, index, array) {
    program_params[val] = true;
});
execute_program();