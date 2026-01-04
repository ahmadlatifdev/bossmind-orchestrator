import { NextResponse } from 'next/server';

const products = [
    {
        id: 1,
        name: "Abstract Canvas Painting",
        description: "Modern abstract art canvas for living room decoration",
        price: 89.99,
        category: "Wall Art",
        image_url: "",
        supplier_url: "",
        profit_margin: 40.00,
        tags: ["wall-art", "modern"],
        is_active: true,
        created_at: "2024-01-15T10:30:00Z",
        updated_at: "2024-01-15T10:30:00Z"
    },
    {
        id: 2,
        name: "Personalized Family Name Sign",
        description: "Modern wooden sign with custom family name",
        price: 49.99,
        category: "Personalized Gifts",
        image_url: "",
        supplier_url: "",
        profit_margin: 60.00,
        tags: ["personalized", "wood", "home"],
        is_active: true,
        created_at: "2024-01-16T11:45:00Z",
        updated_at: "2024-01-16T11:45:00Z"
    }
];

export async function GET() {
    return NextResponse.json({
        success: true,
        count: products.length,
        products: products
    });
}