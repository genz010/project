export function validateProductInput(body) {
    if (!body || typeof body !== "object") {
        return { valid: false, error: "Request body must be a valid JSON object" };
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
        return { valid: false, error: "Product 'name' is required and cannot be empty" };
    }

    const price = Number(body.price);
    if (isNaN(price) || price < 0) {
        return { valid: false, error: "Product 'price' must be a valid non-negative number" };
    }

    return {
        valid: true,
        data: {
            name,
            price: Math.round(price * 100) / 100
        }
    };
}

export function buildProductQuery({ page, limit, search, minPrice, maxPrice } = {}) {
    // pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // search
    if (search && typeof search === "string" && search.trim() !== "") {
        params.push(`%${search.trim()}%`);
        conditions.push(`name ILIKE $${params.length}`);
    }

    // price filter
    if (minPrice !== undefined && minPrice !== null && minPrice !== "") {
        const min = Number(minPrice);
        if (!isNaN(min)) {
            params.push(min);
            conditions.push(`price >= $${params.length}`);
        }
    }

    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== "") {
        const max = Number(maxPrice);
        if (!isNaN(max)) {
            params.push(max);
            conditions.push(`price <= $${params.length}`);
        }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // count query
    const countSql = `SELECT COUNT(*) FROM products ${whereClause}`.trim();
    const countParams = [...params];

    // data query
    params.push(limitNum);
    const limitPlaceholder = `$${params.length}`;

    params.push(offset);
    const offsetPlaceholder = `$${params.length}`;

    const querySql = `SELECT * FROM products ${whereClause} ORDER BY id LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`.trim();

    return {
        querySql,
        params,
        countSql,
        countParams,
        page: pageNum,
        limit: limitNum,
        whereClause
    };
}
