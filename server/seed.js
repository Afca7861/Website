// seed.js — loads sample listings so the site isn't empty on first run.
// EVERY row here is clearly-fake placeholder data, not real AFCA inventory.
// Replace by deleting data/afca.db and inserting real rows (see README),
// or by wiring these tables up to whatever spreadsheet/feed AFCA already
// uses for daily inventory (e.g. the "Daily Cars" workflow).

const db = require("./db");

const vehicleCount = db.prepare("SELECT COUNT(*) AS n FROM vehicles").get().n;
const partCount = db.prepare("SELECT COUNT(*) AS n FROM parts").get().n;
const auctionCount = db.prepare("SELECT COUNT(*) AS n FROM auctions").get().n;

if (vehicleCount === 0) {
  const insert = db.prepare(`
    INSERT INTO vehicles (category, title, price, year, make, model, mileage, condition_note, description, image_url, tags)
    VALUES (@category, @title, @price, @year, @make, @model, @mileage, @condition_note, @description, @image_url, @tags)
  `);
  const sampleLocal = [
    {
      category: "local",
      title: "SAMPLE — 2016 Honda Civic LX",
      price: 9800,
      year: 2016,
      make: "Honda",
      model: "Civic",
      mileage: 128000,
      condition_note: "Inspected",
      description: "Placeholder listing. Replace with real inventory before launch. Reliable commuter car, great first car or newcomer vehicle.",
      image_url: "/assets/placeholder-car.svg",
      tags: "first-time-buyer,budget",
    },
    {
      category: "local",
      title: "SAMPLE — 2015 Toyota RAV4 LE AWD",
      price: 14500,
      year: 2015,
      make: "Toyota",
      model: "RAV4",
      mileage: 142000,
      condition_note: "Inspected",
      description: "Placeholder listing. Family-friendly SUV, AWD for BC winters.",
      image_url: "/assets/placeholder-car.svg",
      tags: "family,budget",
    },
    {
      category: "local",
      title: "SAMPLE — 2014 Ford F-150 XLT",
      price: 16900,
      year: 2014,
      make: "Ford",
      model: "F-150",
      mileage: 165000,
      condition_note: "Inspected",
      description: "Placeholder listing. Work-ready truck, well maintained.",
      image_url: "/assets/placeholder-car.svg",
      tags: "work-truck",
    },
  ];
  const sampleExport = [
    {
      category: "export",
      title: "SAMPLE — 2013 BMW 3 Series (Salvage Title)",
      price: 5200,
      year: 2013,
      make: "BMW",
      model: "3 Series",
      mileage: 98000,
      condition_note: "Salvage — front-end damage, drivable",
      description: "Placeholder listing. Suitable for export/rebuild. Documentation provided for overseas buyers.",
      image_url: "/assets/placeholder-car.svg",
      tags: "salvage,export",
    },
    {
      category: "export",
      title: "SAMPLE — 2012 Mercedes-Benz C-Class (Dismantled — parts/rebuild)",
      price: 3100,
      year: 2012,
      make: "Mercedes-Benz",
      model: "C-Class",
      mileage: 110000,
      condition_note: "Dismantled — sold as-is",
      description: "Placeholder listing. Container shipping available to Eastern Europe, Africa, and the Middle East.",
      image_url: "/assets/placeholder-car.svg",
      tags: "dismantled,export",
    },
  ];
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany([...sampleLocal, ...sampleExport]);
  console.log(`Seeded ${sampleLocal.length + sampleExport.length} sample vehicles.`);
}

if (partCount === 0) {
  const insertPart = db.prepare(`
    INSERT INTO parts (title, category, make_compat, model_compat, condition_note, price, quantity, description, image_url)
    VALUES (@title, @category, @make_compat, @model_compat, @condition_note, @price, @quantity, @description, @image_url)
  `);
  const sampleParts = [
    {
      title: "SAMPLE — Used Alternator",
      category: "Electrical",
      make_compat: "Honda",
      model_compat: "Civic 2012-2016",
      condition_note: "Used — tested",
      price: 85,
      quantity: 3,
      description: "Placeholder listing. Pulled from a low-mileage donor vehicle.",
      image_url: "/assets/placeholder-part.svg",
    },
    {
      title: "SAMPLE — Front Bumper Cover",
      category: "Body",
      make_compat: "Toyota",
      model_compat: "RAV4 2013-2018",
      condition_note: "Used — minor scuffs",
      price: 140,
      quantity: 1,
      description: "Placeholder listing. Priced for local mechanics/dealers.",
      image_url: "/assets/placeholder-part.svg",
    },
    {
      title: "SAMPLE — OEM Headlight Assembly (Pair)",
      category: "Lighting",
      make_compat: "Ford",
      model_compat: "F-150 2009-2014",
      condition_note: "OEM — used",
      price: 220,
      quantity: 2,
      description: "Placeholder listing.",
      image_url: "/assets/placeholder-part.svg",
    },
  ];
  const insertManyParts = db.transaction((rows) => {
    for (const row of rows) insertPart.run(row);
  });
  insertManyParts(sampleParts);
  console.log(`Seeded ${sampleParts.length} sample parts.`);
}

if (auctionCount === 0) {
  const insertAuction = db.prepare(`
    INSERT INTO auctions (title, year, make, model, image_url, auction_source, auction_url, close_time)
    VALUES (@title, @year, @make, @model, @image_url, @auction_source, @auction_url, @close_time)
  `);
  const sampleAuctions = [
    {
      title: "SAMPLE — 2018 Subaru Outback (auction feed placeholder)",
      year: 2018,
      make: "Subaru",
      model: "Outback",
      image_url: "/assets/placeholder-car.svg",
      auction_source: "Sample Auction House",
      auction_url: "https://example.com/replace-with-real-auction-link",
      close_time: "Daily 5:00 PM PT",
    },
    {
      title: "SAMPLE — 2017 Chevrolet Silverado (auction feed placeholder)",
      year: 2017,
      make: "Chevrolet",
      model: "Silverado",
      image_url: "/assets/placeholder-car.svg",
      auction_source: "Sample Auction House",
      auction_url: "https://example.com/replace-with-real-auction-link",
      close_time: "Daily 5:00 PM PT",
    },
  ];
  const insertManyAuctions = db.transaction((rows) => {
    for (const row of rows) insertAuction.run(row);
  });
  insertManyAuctions(sampleAuctions);
  console.log(`Seeded ${sampleAuctions.length} sample auction listings.`);
}

console.log("Seed complete.");
