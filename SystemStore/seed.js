import { Client } from "pg";

let connectionString = process.env.DATABASE || process.env.DATABASE_URL ;

const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

if (!isLocal) {
    connectionString = connectionString.replace(/[?&]sslmode=[^&]+/, "");
}

const client = new Client({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false }
});

await client.connect();
console.log("🔌 Connected to Aiven PostgreSQL...");


await client.query(`
    CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL
    )
`);

console.time("⏱️ Seed 1,000 products");

await client.query(`
    INSERT INTO products (name, price)
    SELECT 
        (ARRAY[
            'Pro Laptop', 
            'Wireless Mouse', 
            'Mechanical Keyboard', 
            '4K Gaming Monitor', 
            'Noise Cancelling Headphones', 
            'USB-C Hub', 
            'Webcam 1080p', 
            'Ergonomic Desk Chair', 
            'RGB Desk Mat', 
            'Aluminum Phone Stand', 
            '1TB External SSD', 
            'Smart Fitness Watch', 
            'Bluetooth Soundbar', 
            'Drawing Tablet', 
            'Fast Wireless Charger'
        ])[1 + floor(random() * 15)::int] || ' (Batch #' || s || ')',
        round((15 + random() * 985)::numeric, 2)
    FROM generate_series(1, 1000) AS s;
`);

console.timeEnd("⏱️ Seed 1,000 products");

const countRes = await client.query("SELECT COUNT(*) FROM products;");
console.log(`✅ Total products in Aiven database: ${countRes.rows[0].count}`);

await client.end();
