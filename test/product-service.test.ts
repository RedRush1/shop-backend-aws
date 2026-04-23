import { main as getProductsList } from '../lib/product-service/getProductsList';
import { main as getProductsById } from '../lib/product-service/getProductsById';
import { products } from '../lib/product-service/products';

describe('getProductsList', () => {
  it('should return 200 with the full products array', async () => {
    const result = await getProductsList({});
    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Content-Type']).toBe('application/json');
    const body = JSON.parse(result.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(products.length);
    expect(body[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      description: expect.any(String),
      price: expect.any(Number),
    });
  });

  it('should include CORS headers', async () => {
    const result = await getProductsList({});
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeDefined();
  });
});

describe('getProductsById', () => {
  const existingProduct = products[0];

  it('should return 200 with the matching product', async () => {
    const event = { pathParameters: { productId: existingProduct.id } };
    const result = await getProductsById(event);
    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Content-Type']).toBe('application/json');
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      id: existingProduct.id,
      title: existingProduct.title,
      description: existingProduct.description,
      price: existingProduct.price,
    });
  });

  it('should return 404 when product is not found', async () => {
    const event = { pathParameters: { productId: 'non-existent-id' } };
    const result = await getProductsById(event);
    expect(result.statusCode).toBe(404);
    expect(result.headers?.['Content-Type']).toBe('application/json');
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
    expect(body.message).toContain('non-existent-id');
  });

  it('should return 404 when productId is undefined', async () => {
    const event = { pathParameters: null };
    const result = await getProductsById(event);
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
  });
});
