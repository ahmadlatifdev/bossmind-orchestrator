export default function Page({ params }: { params: { id: string } }) {
    return (
        <div style={{ padding: "40px" }}>
            <h1>Product {params.id}</h1>
            <p>Details for product {params.id}</p>
            <a href="/products">← Back to Products</a>
        </div>
    );
}