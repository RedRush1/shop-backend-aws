import { products } from './products';

export async function main(event: any) {
  const productId = event.pathParameters?.productId;
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `Product with id "${productId}" not found` }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  };
}

