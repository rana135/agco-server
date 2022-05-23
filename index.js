const express = require('express')
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleWare:-
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.to6z5.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const ProductCollection = client.db("agcoDatabase").collection("products");

        // get all service or data load:-
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = ProductCollection.find(query);
            const products = await cursor.toArray();
            res.send(products)
        })
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('AGCO Server!')
})

app.listen(port, () => {
    console.log(`AGCO Server listening on port ${port}`)
})