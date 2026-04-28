import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { randomUUID as uuidv4 } from 'crypto';

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const PRODUCTS_TABLE = 'products';
const STOCKS_TABLE = 'stock';

const dynamoDB = new DynamoDBClient({ region: REGION });

const products = [
  {
    title: 'Samsung Galaxy S25 Ultra',
    description: 'Latest flagship smartphone with 6.7" AMOLED display, 200MP camera, and Snapdragon 8 Gen 3.',
    price: 1199,
  },
  {
    title: 'iPhone 16 Pro Max',
    description: "Apple's most powerful iPhone with A18 Pro chip, titanium design, and ProRes video recording.",
    price: 1299,
  },
  {
    title: 'NVIDIA RTX 4070 Ti',
    description: 'High-performance GPU for gaming and creative workloads. 16GB GDDR7 VRAM, ray tracing support.',
    price: 849,
  },
  {
    title: 'AMD Ryzen 9 7950X',
    description: "AMD's next-gen desktop CPU. 16 cores, 32 threads, up to 5.7GHz boost clock.",
    price: 599,
  },
  {
    title: 'Sony WF-1000XM5',
    description: 'Premium true wireless earbuds with active noise cancellation and 30h total battery life.',
    price: 279,
  },
  {
    title: 'Corsair Dominator DDR5 32GB',
    description: 'DDR5-6000 32GB (2x16GB) dual-channel kit. Low latency CL30, perfect for gaming and workstation builds.',
    price: 139,
  },
];

const counts = [10, 7, 5, 3, 15, 20];

async function seedProducts(): Promise<void> {
  console.log(`\nSeeding table: ${PRODUCTS_TABLE} (${products.length} items)`);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const id = uuidv4();

    await dynamoDB.send(new PutItemCommand({
      TableName: PRODUCTS_TABLE,
      Item: {
        id:          { S: id },
        title:       { S: p.title },
        description: { S: p.description },
        price:       { N: p.price.toString() },
      },
    }));
    console.log(`  ✓ inserted product: ${p.title} (id=${id})`);

    await dynamoDB.send(new PutItemCommand({
      TableName: STOCKS_TABLE,
      Item: {
        product_id: { S: id },
        count:      { N: counts[i].toString() },
      },
    }));
    console.log(`  ✓ inserted stock:   product_id=${id}, count=${counts[i]}`);
  }
}

async function main() {
  console.log(`Target region: ${REGION}`);

  try {
    await seedProducts();
    console.log('\nDone! All tables seeded successfully.');
  } catch (error) {
    console.error('\nSeeding failed:', error);
    process.exit(1);
  }
}

main();
