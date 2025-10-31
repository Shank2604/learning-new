import connect_db from './db/connect_db.js';
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config({
    path: './.env',
});

connect_db()
.then(() => {
    app.on("error", (err) => {
        console.log("Express app error", err);
    })
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
})
.catch((err) => {
    console.log("MongoDB connection failed: ", err);
});