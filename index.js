const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Invalid token' });
        }

        if (!decoded.email) {
            return res.status(401).send({ error: true, message: 'Invalid token payload' });
        }

        req.decoded = decoded;
        next();
    });
};





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vweq3se.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const usersCollection = client.db("mindfulnessDB").collection("users");
        const instractorsCollection = client.db("mindfulnessDB").collection("instractors");
        const classesCollection = client.db("mindfulnessDB").collection("classes");
        const selectedClassesCollection = client.db("mindfulnessDB").collection("selectedClasses");
        // Connect the client to the server	(optional starting in v4.7)


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // users related apis
        app.get('/users', verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });


        // instractors  apis
        app.get('/instractors', verifyJWT, async (req, res) => {
            const result = await instractorsCollection.find().toArray();
            res.send(result);
        })

        app.get('/top-instractors', async (req, res) => {
            const limit = req.query.limit ? parseInt(req.query.limit) : 6;
            const result = await instractorsCollection.find().limit(limit).toArray();
            res.send(result);
        });

        app.get('/user/instractor/:email', verifyJWT, async (req, res) => {
            console.log('instractor');
            const email = req.params.email;
            console.log(email);

            if (req.decoded.email !== email) {
                return res.send({ instractor: false })
                console.log('!instractor')
            }

            const query = { email: email }
            const user = await instractorsCollection.findOne(query);
            const result = { instractor: user?.role === 'instractor' }
            res.send(result);
        })



        app.get('/user/student/:email', verifyJWT, async (req, res) => {
            console.log('student');
            const email = req.params.email;
            console.log(email);

            if (req.decoded.email !== email) {
                return res.send({ student: false })
                console.log('!student')
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { student: user?.role === 'student' }
            res.send(result);
        })

        app.get('/users/instractor/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const instructor = await instractorsCollection.findOne({ _id: new ObjectId(id) });
                if (!instructor) {
                    return res.status(404).json({ error: true, message: 'Instructor not found' });
                }

                res.json(instructor);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: true, message: 'Server error' });
            }
        });



        app.get('/instructors/:instructorId/classes', verifyJWT, async (req, res) => {
            const instructorId = req.params.instructorId;

            try {
                const classes = await classesCollection.find({ instructorId: instructorId }).toArray();
                res.json(classes);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: true, message: 'Server error' });
            }
        });





        app.post('/instractors', async (req, res) => {
            const newInstractor = req.body;
            const result = await instractorsCollection.insertOne(newInstractor)
            res.send(result);
        })

        app.patch('/users/instractor/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instractor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // admin api
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            console.log('admin');
            const email = req.params.email;
            console.log(email);

            if (req.decoded.email !== email) {
                return res.send({ admin: false })
                console.log('!admin')
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        // cart collection apis
        app.post('/selectedClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await selectedClassesCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/selectedClasses', async (req, res) => {
            const result = await selectedClassesCollection.find().toArray();
            res.send(result);
        })

        app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // classes  apis
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        app.get('/top-classes', async (req, res) => {
            const limit = req.query.limit ? parseInt(req.query.limit) : 6;
            const result = await classesCollection.find().limit(limit).toArray();
            res.send(result);
        });




        // await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Mindfulness server is running")
})

app.listen(port, () => {
    console.log(`Mindfulness server is running on port ${port}`)
})