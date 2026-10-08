import { Client } from "pg";
import { buildProductQuery, validateProductInput } from "./lib/queryEngine.js";


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


await client.query(`
    CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL
    )
`);

const allowedOrigins = [
    "https://systemstore.web.app",
    "https://systemstore.firebaseapp.com",
    "http://localhost:5173",
    "http://localhost:3000"
];


const port = Number(process.env.PORT) || 3000;

Bun.serve({
    port,
    async fetch(req) {
        const url = new URL(req.url);
        const method = req.method;

        const origin = req.headers.get("origin");
        const activeOrigin = allowedOrigins.includes(origin) ? origin : "https://systemstore.web.app";
        
        const corsHeaders = {
            "Access-Control-Allow-Origin": activeOrigin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        const jsonResponse = (data, status = 200) => Response.json(data, {
            status,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            }
        });
        
        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (method === "GET" && url.pathname === "/api/products") {
            
            const query = buildProductQuery({
                page: url.searchParams.get("page"),
                limit: url.searchParams.get("limit"),
                search: url.searchParams.get("search"),
                minPrice: url.searchParams.get("minPrice"),
                maxPrice: url.searchParams.get("maxPrice")
            });

            
            const [productsRes, countRes] = await Promise.all([
                client.query(query.querySql, query.params),
                client.query(query.countSql, query.countParams)
            ]);

            const totalItems = Number(countRes.rows[0]?.count || 0);
            const totalPages = Math.ceil(totalItems / query.limit) || 1;

           
            return jsonResponse({
                data: productsRes.rows,
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: query.page,
                    limit: query.limit,
                    hasNextPage: query.page < totalPages,
                    hasPrevPage: query.page > 1
                },
                debug: {
                    generatedSql: query.querySql,
                    params: query.params,
                    whereClause: query.whereClause
                }
            });
        }

        if (method === "GET" && url.pathname.startsWith("/api/products/")) {
            const id = url.pathname.split("/")[3];
            const res = await client.query("SELECT * FROM products WHERE id = $1", [id]);

            if (!res.rows[0]) {
                return jsonResponse({ error: "Product not found" }, 404);
            }

            return jsonResponse(res.rows[0]);
        }

        if (method === "POST" && url.pathname === "/api/products") {
            const body = await req.json().catch(() => null);

            // validate
            const validation = validateProductInput(body);
            if (!validation.valid) {
                return jsonResponse({ error: validation.error }, 400);
            }

            const res = await client.query(
                "INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *",
                [validation.data.name, validation.data.price]
            );

            return jsonResponse(res.rows[0], 201);
        }

        // error
        return jsonResponse({ error: "Route not found" }, 404);
    }
});

console.log(`⚡ SystemStore API Engine running at http://localhost:${port}`);
