const fs = require('fs');
const path = require('path');
const { parseFile } = require('@fast-csv/parse');
const { LocalIndex } = require('vectra');

const index = new LocalIndex(path.join(__dirname, 'index'));

const filePath = 'animes.csv';

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
                console.log(`${rowCount} records loaded`);
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
                console.log('Records were loaded')
            }
        } catch (e) {
            console.log('There was a problem reading a saving data', e)
        }

        return;
    }
    console.log('File does not exist yet')
}

async function save_records_vectra() {
    if (!await index.isIndexCreated()) {
        await index.createIndex();
    }
    for (let item of df) {
        let { embedding: embedding, ...metadata } = item;
        await index.insertItem({
            vector: embedding,
            metadata: { ...metadata }
        });
    }
    console.log('Records were indexed')
}

async function check_records() {
    let record = df[2];
    const results = await index.queryItems(record.embedding, 3);
    if (results.length > 0) {
        for (const result of results) {
            console.log(`[${result.score}] ${JSON.stringify(result.item.metadata)}`);
        }
    } else {
        console.log(`No results found.`);
    }
}

async function execute_program() {
    await load_main_data();
    if (program_params.hasOwnProperty('load')) {
        await save_records_vectra();
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