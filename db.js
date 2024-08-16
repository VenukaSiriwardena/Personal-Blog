import pg from 'pg';
import env from "dotenv";
env.config();
const { Pool } = pg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "blog",
  password: process.env.DB_PASSWORD, // Ensure you have the correct environment variable set
  port: 5432,
});

export default pool;
