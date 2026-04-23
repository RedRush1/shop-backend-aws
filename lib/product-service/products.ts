export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
}

export const products: Product[] = [
  {
    description:
      'Latest flagship smartphone with 6.7" AMOLED display, 200MP camera, and Snapdragon 8 Gen 3.',
    id: "7567ec4b-b10c-48c5-9345-fc73c48a80aa",
    price: 1199,
    title: "Samsung Galaxy S25 Ultra",
  },
  {
    description:
      "Apple's most powerful iPhone with A18 Pro chip, titanium design, and ProRes video recording.",
    id: "7567ec4b-b10c-48c5-9345-fc73c48a80a1",
    price: 1299,
    title: "iPhone 16 Pro Max",
  },
  {
    description:
      "High-performance GPU for gaming and creative workloads. 16GB GDDR7 VRAM, ray tracing support.",
    id: "7567ec4b-b10c-48c5-9345-fc73c48a80a3",
    price: 849,
    title: "NVIDIA RTX 4070 Ti",
  },
  {
    description:
      "AMD's next-gen desktop CPU. 16 cores, 32 threads, up to 5.7GHz boost clock.",
    id: "7567ec4b-b10c-48c5-9345-fc73348a80a1",
    price: 599,
    title: "AMD Ryzen 9 7950X",
  },
  {
    description:
      "Premium true wireless earbuds with active noise cancellation and 30h total battery life.",
    id: "7567ec4b-b10c-48c5-9445-fc73c48a80a2",
    price: 279,
    title: "Sony WF-1000XM5",
  },
  {
    description:
      "DDR5-6000 32GB (2×16GB) dual-channel kit. Low latency CL30, perfect for gaming and workstation builds.",
    id: "7567ec4b-b10c-45c5-9345-fc73c48a80a1",
    price: 139,
    title: "Corsair Dominator DDR5 32GB",
  },
];

