// Data for /services/{slug} landing pages. Copy is original; no prices, ratings or volume claims.
export const SERVICE_PAGES = [
  {
    slug: "man-and-van",
    name: "Man and Van",
    image: "single_items",
    intro:
      "Book a local driver with a van for the jobs that are too big for a car but don't need a removal firm: a few boxes to a new flat, a sofa from a showroom, or a clear-out run to the tip.",
    moves: ["Small flat and student moves", "Single bulky items like sofas, beds and fridges", "Boxes, suitcases and storage unit runs", "Shop and showroom collections", "Office kit and IT equipment", "Clear-outs and recycling centre runs"],
    vehicles: ["Small Van", "Short Wheelbase Van", "Long Wheelbase Van", "Luton Van"],
    related: ["furniture-delivery", "house-removals", "marketplace-collection"],
    faqs: [
      { q: "Will the driver help with loading?", a: "Tell us when you post the job. You can say whether you'll load yourself, want the driver to help, or need a second person, and drivers see this before they take the job." },
      { q: "How big a van do I need?", a: "Describe the items and we suggest a suitable vehicle. As a rough guide, a few boxes and a chair fit a small van, while a one-bedroom flat usually needs a large van or Luton." },
      { q: "Can I book a man and van for today?", a: "Yes. Choose ASAP to have your job offered to nearby available drivers straight away, or pick a date and time if you want to plan ahead." },
      { q: "Do I need to be there at both ends?", a: "Someone should be at pickup and drop-off to hand over and receive the items. You can add contact details for another person if you can't be there yourself." },
      { q: "What if my items don't fit?", a: "List your items as accurately as you can, including anything heavy or awkward. If something changes, message your driver in the app before they set off." },
    ],
  },
  {
    slug: "furniture-delivery",
    name: "Furniture Delivery",
    image: "furniture",
    intro:
      "Get a single wardrobe, a corner sofa or a full set of dining furniture moved by a driver who knows how to handle large, heavy pieces through doorways and up stairs.",
    moves: ["Sofas, corner sofas and armchairs", "Beds, mattresses and headboards", "Wardrobes, drawers and sideboards", "Dining tables and chairs", "Flat-pack furniture from retail stores", "Antique and vintage pieces"],
    vehicles: ["Long Wheelbase Van", "Luton Van", "Luton Van with Tail Lift"],
    related: ["man-and-van", "marketplace-collection", "house-removals"],
    faqs: [
      { q: "Can the driver take furniture upstairs?", a: "Yes, if you say so in the job. Add the floor, whether there's a lift, and any tight stairways so drivers can plan the right help." },
      { q: "Will my furniture be protected?", a: "Mark fragile or valuable pieces in the job and say if you need blankets or wrapping. Drivers see this before they accept, so they can come prepared." },
      { q: "Can you collect from a shop or warehouse?", a: "Yes. Add the store's address and any collection reference. Many customers use Cargo One to bring home items they've bought in store." },
      { q: "Do you assemble or dismantle furniture?", a: "Assembly isn't included as standard. If an item needs to be taken apart to fit through a door, it's best to do this before the driver arrives." },
      { q: "How do I know when it's delivered?", a: "You can follow the driver live on the map, and they upload photo proof of delivery when the job is done." },
    ],
  },
  {
    slug: "same-day-courier",
    name: "Same Day Courier",
    image: "same_day",
    intro:
      "When something has to arrive today, post an ASAP job and it's offered to available drivers near the pickup. One driver, one job, straight from A to B with no depot stops.",
    moves: ["Urgent documents and contracts", "Spare parts for a breakdown or job site", "Samples and prototypes", "Forgotten items and personal belongings", "Medical and lab supplies (non-hazardous)", "Last-minute event and shop stock"],
    vehicles: ["Motorcycle Courier", "Small Van", "Short Wheelbase Van", "Long Wheelbase Van"],
    related: ["parcel-delivery", "pallet-delivery", "man-and-van"],
    faqs: [
      { q: "How quickly will a driver be assigned?", a: "ASAP jobs are offered to nearby online drivers as soon as you pay the deposit. You'll see when a driver accepts, and then their live location on the way to you." },
      { q: "Is it a direct delivery?", a: "Yes. Your driver goes straight from pickup to drop-off with your items, rather than via a sorting depot." },
      { q: "Can I send something long distance on the same day?", a: "Yes, as long as the journey can be completed within the day. The quote takes the distance into account." },
      { q: "What can't I send?", a: "We don't carry illegal, dangerous or hazardous goods, cash or live animals. If you're unsure, contact support before you book." },
      { q: "How will I know it arrived?", a: "The driver uploads photo proof of delivery and you get a notification as soon as the job is complete." },
    ],
  },
  {
    slug: "house-removals",
    name: "House Removals",
    image: "house_moves",
    intro:
      "Move home with a driver and vehicle sized to your property, from a studio flat to a family house. Plan it for your moving day or book at short notice.",
    moves: ["Studio, flat and house moves", "Furniture, white goods and appliances", "Boxed belongings and wardrobes", "Garden furniture and equipment", "Moves into and out of storage", "Part-loads and partial moves"],
    vehicles: ["Long Wheelbase Van", "Luton Van", "Luton Van with Tail Lift", "7.5 Tonne Lorry"],
    related: ["furniture-delivery", "man-and-van", "car-transport"],
    faqs: [
      { q: "How far in advance should I book?", a: "Book as soon as you know your moving date to get the most choice of drivers. Short-notice moves are possible too, depending on who's available." },
      { q: "How many helpers will come?", a: "Say how many people you need when you post the job. Drivers can see this before they accept, so you get someone who can bring the help you asked for." },
      { q: "Should I pack before the driver arrives?", a: "Yes. Have everything boxed and ready to go, with fragile boxes labelled, to keep the move quick and safe." },
      { q: "Can you move me to another city?", a: "Yes. We handle local and long-distance moves across the UK, and the quote reflects the journey." },
      { q: "What happens if there's a problem on the day?", a: "You can message your driver in the app, and our support team can help if anything goes wrong." },
    ],
  },
  {
    slug: "car-transport",
    name: "Car Transport",
    image: "vehicles",
    intro:
      "Move a car without driving it: after buying one online, for a dealer transfer, or to get a non-runner home. Book 24/7, 365 days a year, as an ASAP job, an open bid or a fixed-price booking.",
    recovery247: true,
    moves: ["Cars bought online or at auction", "Dealer-to-dealer transfers", "Classic and project cars", "Non-runners and SORN vehicles", "Cars going to or from storage", "Small vans and 4x4s"],
    vehicles: ["Car Transporter", "Enclosed Trailer Van", "Light Recovery Van", "Pickup Recovery", "3.5T Recovery Truck", "7.5T Recovery Truck", "10–18T Recovery", "Heavy Recovery / Lowloader"],
    related: ["vehicle-recovery", "motorbike-transport", "boat-transport"],
    faqs: [
      { q: "Does the car need to be driveable?", a: "No. Tell us if it's a non-runner, has flat tyres or no keys, so drivers bring the right equipment such as a winch." },
      { q: "Can I book car transport at night or at the weekend?", a: "Yes. You can book 24/7, every day of the year, and ASAP jobs go to drivers available around the clock near the pickup." },
      { q: "Can you collect from a dealer or auction house?", a: "Yes. Add the collection address and any release reference or paperwork the site needs to hand the car over." },
      { q: "What details do I need to give?", a: "The make and model, whether it runs, its rough size, and any access restrictions at pickup or drop-off." },
      { q: "Can I track the car?", a: "Yes. Once the driver sets off you can follow them on the map, and you'll get photo proof at delivery." },
    ],
  },
  {
    slug: "vehicle-recovery",
    heroImage: "/images/recovery-truck-hero.webp",
    name: "Vehicle Recovery",
    image: "vans",
    intro:
      "Get a broken-down, damaged or non-running vehicle moved to a garage, your home or a scrapyard. Book 24/7, 365 days a year: post an ASAP job for an urgent recovery, or use a bid or fixed-price booking for a planned move.",
    recovery247: true,
    moves: ["Breakdowns needing a tow to a garage", "Non-runners and project vehicles", "Accident-damaged cars", "Vans up to 3.5 tonnes", "Vehicles going for scrap or salvage", "Moves to and from MOT and repair shops"],
    vehicles: ["Light Recovery Van", "Pickup Recovery", "Motorcycle Recovery", "3.5T Recovery Truck", "7.5T Recovery Truck", "10–18T Recovery", "26T Recovery", "32T Recovery", "Heavy Recovery / Lowloader", "Heavy Articulated Recovery", "Heavy 6×4 / 8×4 Recovery", "Heavy Tractor Recovery", "Car Transporter"],
    related: ["car-transport", "motorbike-transport", "machinery-haulage"],
    faqs: [
      { q: "Can I get a recovery right now, day or night?", a: "Yes. Recovery can be booked 24/7, 365 days a year. Choose ASAP and your job goes to nearby recovery drivers who are online, and you can follow your driver live once one accepts." },
      { q: "Do I need to stay with the vehicle?", a: "If you can, yes. If you can't stay, add the location, how to access the vehicle and where the keys are." },
      { q: "Can you recover from a motorway?", a: "For safety, vehicles on a live motorway should first be moved by the official services. We can then collect from a safe place such as a recovery yard." },
      { q: "What if the wheels don't turn?", a: "Say so in the job. Drivers with winches or skates can then be matched to it." },
      { q: "Will I get proof of delivery?", a: "Yes. The driver uploads photos at drop-off so you have a record of the vehicle's condition when it arrived." },
    ],
  },
  {
    slug: "motorbike-transport",
    name: "Motorbike Transport",
    image: "motorcycles",
    intro:
      "Move a motorbike, scooter or moped safely strapped down on a suitable trailer or van, whether you've bought it privately, broken down, need it at a workshop or are taking it to an event. Book 24/7, as ASAP, bid or fixed price.",
    recovery247: true,
    moves: ["Road bikes and sports bikes", "Scooters and mopeds", "Off-road, trail and motocross bikes", "Classic and vintage motorcycles", "Non-running bikes", "Quad bikes"],
    vehicles: ["Motorcycle Recovery", "Motorcycle Trailer", "Enclosed Trailer Van", "Light Recovery Van", "Pickup Recovery"],
    related: ["car-transport", "vehicle-recovery", "marketplace-collection"],
    faqs: [
      { q: "How is the bike secured?", a: "Drivers strap the bike down so it stays upright and stable for the journey. Mention anything unusual about the bike so they come prepared." },
      { q: "Can you move a bike that doesn't run?", a: "Yes. Mention it in the job so the driver knows to bring a ramp or a second person to help load it." },
      { q: "Can you collect from a private seller?", a: "Yes. Add the seller's address and phone number, and make sure the sale is agreed before the driver arrives." },
      { q: "Do I need to remove luggage or accessories?", a: "It's best to remove loose items like top boxes or panniers, or say if they're staying on." },
      { q: "My bike has broken down. Can someone come now?", a: "You can book 24/7. Choose ASAP and the job goes to motorcycle recovery drivers available around the clock near you, or pick a date if it can wait." },
    ],
  },
  {
    slug: "pallet-delivery",
    name: "Pallet Delivery",
    image: "pallets",
    intro:
      "Send one pallet or a full load directly from collection to delivery, with a vehicle chosen for the size, weight and loading facilities at each end.",
    moves: ["Standard UK and Euro pallets", "Half and quarter pallets", "Stock for shops and warehouses", "Building and trade materials", "Event and exhibition kit on pallets", "Multi-pallet business deliveries"],
    vehicles: ["Luton Van with Tail Lift", "Curtain Side Vehicle", "7.5 Tonne Lorry", "18 Tonne Lorry"],
    related: ["parcel-delivery", "machinery-haulage", "same-day-courier"],
    faqs: [
      { q: "Do I need a forklift at collection?", a: "Not always. If there's no forklift or loading bay, say so and choose a vehicle with a tail lift." },
      { q: "How should the pallet be prepared?", a: "Shrink-wrap the goods securely, keep them within the pallet's edges, and add the weight and height when you post the job." },
      { q: "Can you deliver pallets the same day?", a: "Yes, depending on vehicle availability near the pickup. Choose ASAP for urgent loads." },
      { q: "Is my pallet delivered directly?", a: "Yes. Your pallet goes straight from collection to delivery with one driver, rather than through a pallet network hub." },
      { q: "Can businesses book regular pallet runs?", a: "Yes. You can post jobs as often as you need. See our business page for more on using Cargo One for your company." },
    ],
  },
  {
    slug: "marketplace-collection",
    name: "Marketplace Collection",
    image: "auction_marketplace",
    intro:
      "Bought something on eBay, Facebook Marketplace, Gumtree or at an auction that you can't collect yourself? A local driver can pick it up and bring it to your door.",
    moves: ["Furniture from online sellers", "Appliances and white goods", "Bikes, gym equipment and garden items", "Auction lots and house-clearance buys", "Collectables and antiques", "Large items from private sellers"],
    vehicles: ["Small Van", "Short Wheelbase Van", "Long Wheelbase Van", "Luton Van"],
    related: ["furniture-delivery", "man-and-van", "motorbike-transport"],
    faqs: [
      { q: "Do I need to pay the seller first?", a: "Yes. Agree the sale and payment with the seller before the driver arrives. The driver only collects and delivers." },
      { q: "What information should I give?", a: "The seller's address and contact number, a description or photos of the item, and any collection times the seller has given you." },
      { q: "Can the driver check the item?", a: "The driver can take photos at collection so you can see the item before it's on its way. They can't test or inspect it for faults." },
      { q: "What if the seller isn't there?", a: "Your driver will try to contact the seller and keep you updated in the app. Always confirm a collection time with the seller first." },
      { q: "Can you collect from an auction house?", a: "Yes. Add the lot number and any collection reference the auction house needs." },
    ],
  },
  {
    slug: "parcel-delivery",
    name: "Parcel Delivery",
    image: "parcels",
    intro:
      "Send parcels and packages with a dedicated driver rather than a sorting network, so your item goes straight to its destination, today or on a date you choose.",
    moves: ["Boxes and packages", "Fragile parcels that need careful handling", "Business samples and returns", "Gifts and personal items", "Multiple parcels in one run", "Items that won't fit a standard courier size"],
    vehicles: ["Motorcycle Courier", "Small Van", "Short Wheelbase Van"],
    related: ["same-day-courier", "pallet-delivery", "marketplace-collection"],
    faqs: [
      { q: "Is my parcel delivered directly?", a: "Yes. The driver who collects your parcel delivers it, with no depot or sorting centre in between." },
      { q: "How should I package it?", a: "Use a sturdy box with enough padding for the contents, and seal it well. Add the size and weight when you post the job." },
      { q: "Can I send several parcels at once?", a: "Yes. List them all in one job, or post separate jobs for different addresses." },
      { q: "Can I send fragile items?", a: "Yes. Mark the job as fragile and package the item carefully. Drivers see this before they accept." },
      { q: "Will I get proof of delivery?", a: "Yes. The driver uploads a photo, and the recipient's signature where available, when the parcel is delivered." },
    ],
  },
  {
    slug: "boat-transport",
    name: "Boat Transport",
    image: "boats",
    intro:
      "Move a small boat, dinghy, jet ski or boat on its own trailer between home, marina, storage or a boatyard, with a driver who has a suitable tow vehicle.",
    moves: ["Dinghies and small sailing boats", "RIBs and small motor boats", "Jet skis and personal watercraft", "Boats on their own road trailers", "Kayaks and canoes in bulk", "Moves to boatyards and storage"],
    vehicles: ["Flatbed Truck", "Recovery Truck", "Other (tow vehicle with trailer)"],
    related: ["car-transport", "machinery-haulage", "vehicle-recovery"],
    faqs: [
      { q: "Does the boat need its own trailer?", a: "If it's already on a road-legal trailer, a driver with a suitable tow vehicle can move it. If not, say so and describe the boat so a driver with the right equipment can take the job." },
      { q: "What details do you need?", a: "The boat's length, its approximate weight with the trailer, the pickup and drop-off locations, and any slipway or marina access details." },
      { q: "Can you collect from a marina?", a: "Yes. Add the marina's name and any booking or gate information the driver needs to get in." },
      { q: "Do I need to prepare the boat?", a: "Secure or remove loose items, covers and equipment, and check the trailer's lights and tyres are in working order." },
      { q: "Can I track the move?", a: "Yes. You can follow the driver live, and they'll upload photos when the boat is delivered." },
    ],
  },
  {
    slug: "machinery-haulage",
    name: "Machinery Haulage",
    image: "machinery",
    intro:
      "Transport plant, machinery and heavy equipment between sites, depots and customers, on flatbed trucks, lorries or Hiab crane vehicles for loading.",
    moves: ["Mini diggers and small excavators", "Dumpers, rollers and compact plant", "Generators and compressors", "Workshop and factory machinery", "Agricultural equipment", "Access equipment and scissor lifts"],
    vehicles: ["Flatbed Truck", "Hiab Crane Vehicle", "7.5 Tonne Lorry", "18 Tonne Lorry"],
    related: ["pallet-delivery", "vehicle-recovery", "boat-transport"],
    faqs: [
      { q: "What information do you need for machinery?", a: "The make and model, weight, dimensions, and whether it can be driven or needs lifting on and off." },
      { q: "Can the driver load it with a crane?", a: "Yes, if you choose a vehicle with a crane. Say whether there's a forklift or crane on site, or if the driver needs to bring one." },
      { q: "Can you move machinery to a building site?", a: "Yes. Add any site rules, access times and a contact for the site manager so the delivery runs smoothly." },
      { q: "Is the load secured for the journey?", a: "Drivers are responsible for securing the load for the journey. Give accurate weight and dimensions so they can bring the right restraints." },
      { q: "Can you handle very large loads?", a: "For abnormal loads that need permits or escorts, contact us first so we can check what's possible." },
    ],
  },
];

export const SERVICE_BY_SLUG = Object.fromEntries(SERVICE_PAGES.map((s) => [s.slug, s]));

const PAY_FAQ = {
  q: "How do I pay?",
  a: "You pay Cargo One's booking fee by card through Stripe to confirm the booking. It's a percentage of the driver's price, tiered by job value, and you see it before you pay. The driver's price itself is paid directly to the driver on delivery.",
};

const cancelFaq = (what) => ({
  q: "Can I cancel?",
  a: `Before a driver accepts, you can cancel free of charge and your booking fee is refunded in full. After a driver accepts, you can still cancel in the app until ${what} collected. A cancellation fee (currently 20% of the booking fee) is kept and the rest goes back to your card, and the app shows the exact amounts before you confirm. Once ${what} collected, the booking can't be cancelled in the app, so contact support@cargoone.co.uk.`,
});

// Data for /how-it-works/{slug} booking-type pages. Copy mirrors how the app works today.
export const BOOKING_TYPES = [
  {
    slug: "bid-jobs",
    name: "Bid Jobs",
    image: "heroSeoBoxes",
    intro:
      "Post a scheduled job and let verified drivers send you their offers. Compare each driver's price, rating and reviews, then accept the one that suits you.",
    steps: [
      { title: "Post your job", body: "Add pickup, drop-off, a date and what you're moving. You can set a maximum budget if you want to." },
      { title: "Drivers send offers", body: "Verified drivers who can do the job send you a price, often with a short message." },
      { title: "Compare and accept", body: "See each driver's price, rating and number of reviews side by side, then accept the offer you want." },
      { title: "Pay the booking fee", body: "Pay Cargo One's booking fee by card to confirm. The driver's price is paid to the driver on delivery." },
      { title: "Track and get proof", body: "Follow your driver live on the day, chat in the app and get photo proof of delivery." },
    ],
    bestFor: [
      "Planned moves where you'd like to compare offers",
      "House removals and multi-item furniture jobs",
      "Unusual or awkward loads where drivers price the detail",
      "Anyone who wants to choose a driver by rating and reviews",
    ],
    related: ["house-removals", "furniture-delivery", "man-and-van"],
    faqs: [
      { q: "How long do I have to wait for offers?", a: "It depends on the job, the route and how many drivers are available for your date. You'll be notified as offers come in, and you can accept one whenever you're ready." },
      { q: "Do I have to accept an offer?", a: "No. Posting a job is free and you only pay the booking fee once you accept an offer." },
      { q: "What can I see about each driver?", a: "Each offer shows the driver's price, their rating and how many reviews they have, so you can compare before you choose." },
      PAY_FAQ,
      cancelFaq("your items are"),
    ],
  },
  {
    slug: "fixed-price-jobs",
    name: "Fixed Price Jobs",
    image: "heroServices",
    intro:
      "Set your price up front and post the job. Drivers see exactly what the job pays, and a suitable driver accepts it. No bidding and no back and forth.",
    steps: [
      { title: "Post your job with a price", body: "Add the job details and set a fixed price. We show a suggested price as a guide." },
      { title: "A suitable driver accepts", body: "Drivers see your price up front. A verified driver whose vehicle suits the job accepts it." },
      { title: "Pay the booking fee", body: "Pay Cargo One's booking fee by card to confirm. The driver's price is paid to the driver on delivery." },
      { title: "Track and get proof", body: "Follow your driver live on the day and get photo proof when it's delivered." },
    ],
    bestFor: [
      "Regular or routine jobs where you know the going rate",
      "Businesses that want a set cost for each delivery",
      "Simple A to B moves like parcels, pallets and single items",
      "Anyone who'd rather not compare offers",
    ],
    related: ["pallet-delivery", "parcel-delivery", "marketplace-collection"],
    faqs: [
      { q: "Who sets the fixed price?", a: "You do. When you post the job we show a suggested price as a guide, and you choose the price drivers will see." },
      { q: "What's the difference from a Bid Job?", a: "With a Bid Job, drivers send you offers to compare. With a Fixed Price Job, the price is set before you post it and the first suitable driver to accept takes the job." },
      { q: "What if no driver accepts my price?", a: "Your job stays open to drivers until one accepts. No booking fee is taken before then, so if it isn't being picked up you can cancel it free of charge and post it again as a Bid Job." },
      PAY_FAQ,
      cancelFaq("your items are"),
    ],
  },
  {
    slug: "asap-transport",
    description: "Need it moved now? Get an instant price for ASAP Transport, book 24/7 and track a nearby driver live, with drivers available around the clock.",
    name: "ASAP Transport",
    image: "same_day",
    intro:
      "Need something moved now? Get an instant price, pay the booking fee, and your job is sent straight to available drivers nearby. Book 24/7, with drivers available around the clock.",
    steps: [
      { title: "Get an instant price", body: "Enter pickup, drop-off and what you're moving, then choose a vehicle. The price is shown straight away." },
      { title: "Pay the booking fee", body: "Pay Cargo One's booking fee by card. The driver's price is paid to the driver on delivery." },
      { title: "Nearby drivers are alerted", body: "Available drivers near the pickup are alerted first, and the search widens if needed. The first suitable driver to accept is assigned." },
      { title: "Track it live", body: "See your driver on the map from the moment they accept, through collection to drop-off." },
      { title: "Get proof of delivery", body: "The driver uploads photo proof when the job is done and you get a notification." },
    ],
    bestFor: [
      "Urgent same-day deliveries",
      "Last-minute collections from shops and sellers",
      "Business jobs that can't wait until tomorrow",
      "Jobs that come up at night or at the weekend",
    ],
    related: ["same-day-courier", "man-and-van", "parcel-delivery"],
    faqs: [
      { q: "When can I book ASAP Transport?", a: "You can book 24/7, every day of the year. ASAP jobs go to drivers who are online and available at that moment." },
      { q: "How is a driver chosen?", a: "Available drivers near the pickup with a suitable vehicle are alerted first. If needed, the search widens to drivers further away. The first suitable driver to accept is assigned to your job." },
      { q: "What if no driver has accepted yet?", a: "While your job is still waiting for a driver, you can cancel it in the app and your booking fee is refunded in full." },
      PAY_FAQ,
      cancelFaq("your items are"),
    ],
  },
  {
    slug: "asap-recovery",
    description: "24/7 ASAP Recovery for breakdowns and non-runners. Get an instant price, book 24/7 and track your recovery driver live.",
    name: "ASAP Recovery",
    image: "vehicles",
    intro:
      "Broken down or stuck with a non-runner? Book 24/7 and your recovery job is sent straight to recovery drivers available around the clock near you, with live tracking from acceptance to drop-off.",
    vehiclesFrom: "vehicle-recovery",
    heroImage: "/images/recovery-truck-hero.webp",
    steps: [
      { title: "Tell us about the vehicle", body: "Add where the vehicle is, where it's going, and whether it runs, has keys or has wheels that won't turn." },
      { title: "Get an instant price", body: "Choose a suitable recovery vehicle and see the price straight away." },
      { title: "Pay the booking fee", body: "Pay Cargo One's booking fee by card. The driver's price is paid to the driver on delivery." },
      { title: "Recovery drivers are alerted", body: "Recovery drivers near you are alerted first, and the search widens if needed. The first suitable driver to accept is assigned." },
      { title: "Track the recovery live", body: "Follow the recovery truck on the map, and get photos when the vehicle is dropped off." },
    ],
    bestFor: [
      "Urgent breakdowns at home, at work or by the roadside",
      "Non-runners that need moving to a garage or home",
      "Accident-damaged vehicles that can't be driven",
      "Cars, vans, motorbikes and heavier vehicles",
    ],
    related: ["vehicle-recovery", "car-transport", "motorbike-transport"],
    faqs: [
      { q: "Can I book a recovery at night or on a bank holiday?", a: "Yes. You can book 24/7, 365 days a year. Your job goes to recovery drivers who are online at that moment." },
      { q: "What if my vehicle is on a motorway?", a: "For safety, vehicles on a live motorway should first be moved by the official services. You can then book a recovery from a safe place such as a recovery yard." },
      { q: "Do I need to stay with the vehicle?", a: "If you can, yes. If you can't, add the exact location, how to access the vehicle and where the keys are." },
      PAY_FAQ,
      cancelFaq("the vehicle is"),
    ],
  },
];

export const BOOKING_TYPE_BY_SLUG = Object.fromEntries(BOOKING_TYPES.map((b) => [b.slug, b]));

export const SITE_URL = "https://cargoone.co.uk";

export const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Cargo One",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon-512.png`,
  areaServed: { "@type": "Country", name: "United Kingdom" },
};

// Existing marketing pages (mirrors each page's <SEO> props) — used by the build-time prerender.
export const MARKETING_ROUTES = [
  { path: "/how-it-works", img: "heroHow", title: "How It Works | Cargo One", h1: "How it works", description: "Six simple steps to book a delivery on Cargo One. Post a job, compare quotes from vetted UK drivers, pay a small booking fee via Stripe, and track live to your doorstep." },
  { path: "/services", img: "heroServices", title: "Delivery Services | Cargo One", h1: "Delivery services", description: "Everything Cargo One moves — parcels, pallets, house moves, vehicles, motorcycles, freight, and commercial logistics. Book a vetted UK driver in minutes." },
  { path: "/business", img: "heroBusiness", title: "Business Accounts | Cargo One", h1: "Cargo One for Business", description: "Cargo One for Business — UK logistics on tap. Volume discounts, monthly invoicing, priority driver matching, API access and enterprise SLAs." },
  { path: "/drivers", img: "heroDrivers", title: "Become a Driver | Cargo One", h1: "Drive with Cargo One", description: "Join Cargo One as a driver and earn on your own terms. No commission on driver bids, verified customers, and instant on-delivery payments across the UK." },
  { path: "/faq", img: "heroFaq", title: "FAQ | Cargo One", h1: "Frequently asked questions", description: "Frequently asked questions about Cargo One — pricing, driver verification, secure payments, live tracking, and proof of delivery." },
  { path: "/contact", img: "heroContact", title: "Contact Us | Cargo One", h1: "Contact us", description: "Get in touch with Cargo One — customer support, driver support, business enquiries and press. 24/7 assistance for urgent safety concerns." },
  { path: "/trust-safety", img: "heroTrust", title: "Trust & Safety | Cargo One", h1: "Trust & Safety", description: "How Cargo One keeps deliveries safe — driver verification, Stripe secure payments, live GPS tracking, photo proof of delivery, and GDPR-compliant data handling." },
  { path: "/about", img: "heroAbout", title: "About Cargo One", h1: "About Cargo One", description: "Meet Cargo One — the fair, transparent UK logistics marketplace matching customers with vetted drivers. Our mission, values and story." },
  { path: "/terms", title: "Terms & Conditions", h1: "Terms & Conditions", description: "Cargo One Terms & Conditions." },
  { path: "/privacy", title: "Privacy Policy", h1: "Privacy Policy", description: "Cargo One Privacy Policy." },
  { path: "/cookies", title: "Cookie Policy", h1: "Cookie Policy", description: "Cargo One Cookie Policy." },
];

export function serviceSeo(service) {
  return {
    path: `/services/${service.slug}`,
    title: `${service.name} – Instant Quote | Cargo One`,
    h1: `${service.name} – instant quote`,
    description: `${service.intro.split(". ")[0].replace(/\.$/, "")}. Get an instant quote and book a verified UK driver with live tracking.`,
  };
}

export function serviceJsonLd(service) {
  const url = `${SITE_URL}/services/${service.slug}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      serviceType: service.name,
      description: service.intro,
      url,
      provider: { "@type": "Organization", name: "Cargo One", url: SITE_URL },
      areaServed: { "@type": "Country", name: "United Kingdom" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: service.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Services", item: `${SITE_URL}/services` },
        { "@type": "ListItem", position: 3, name: service.name, item: url },
      ],
    },
  ];
}

export function bookingTypeSeo(type) {
  return {
    path: `/how-it-works/${type.slug}`,
    title: `${type.name} – How Booking Works | Cargo One`,
    h1: `${type.name} on Cargo One`,
    description: type.description || `${type.intro.split(". ")[0].replace(/\.$/, "")}. See how it works, who it suits, and how payment works.`,
  };
}

export function bookingTypeJsonLd(type) {
  return [
    faqJsonLd(type.faqs),
    breadcrumbJsonLd([
      ["Home", "/"],
      ["How it works", "/how-it-works"],
      [type.name, `/how-it-works/${type.slug}`],
    ]),
  ];
}

function faqJsonLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${path}` })),
  };
}

// ---------- Driver recruitment pages (/drivers/{slug} and /drivers/jobs/{city}) ----------
export const DRIVER_SIGNUP_HREF = "/auth/register?role=driver";

export const DRIVER_PAY_LINE = "CargoOne takes no commission from your price — the booking fee is paid by the customer.";

export const DRIVER_WORK_FLOW = [
  { title: "Live Mode: ASAP Transport", body: "Go online in the driver app and share your location. ASAP Transport offers are sent to online drivers nearby with a suitable vehicle, 24/7. The first suitable driver to accept gets the job." },
  { title: "Live Mode: ASAP Recovery", body: "With a recovery vehicle on your profile, you can also receive ASAP Recovery offers for breakdowns and non-runners, around the clock. Go offline whenever you want to stop." },
  { title: "Bid Jobs", body: "Customers post scheduled jobs and you send your own price. The customer compares offers and accepts the one they want." },
  { title: "Fixed Price Jobs", body: "Some customers set a price up front. If the job and price suit you, accept it. There's no bidding." },
];

export const DRIVER_DOCUMENTS = [
  "Driving licence",
  "Insurance for the work you do (for example goods-in-transit and public liability where required)",
  "Vehicle registration document (V5C)",
  "Photos of your vehicle",
  "A profile photo",
  "Proof of address",
];

export const DRIVER_PAY_STEPS = [
  "You set your price on Bid Jobs, or see the price before you accept Fixed Price Jobs and ASAP offers.",
  "The customer pays Cargo One's booking fee by card to confirm the booking.",
  "The customer pays your price directly to you on delivery, unless the booking screen says otherwise.",
  DRIVER_PAY_LINE,
];

const DRIVER_PAY_FAQ = {
  q: "How do I get paid?",
  a: `The customer pays your price directly to you on delivery, unless the booking screen says otherwise. ${DRIVER_PAY_LINE}`,
};

const DRIVER_DOCS_FAQ = {
  q: "What do I need to sign up?",
  a: "Register as a driver and upload your driving licence, insurance, V5C vehicle registration, vehicle photos, a profile photo and proof of address. Cargo One reviews each document and your account is activated once they're all approved.",
};

export const DRIVER_TYPES = [
  {
    slug: "van-drivers",
    name: "Van Drivers",
    h1: "Van driver jobs",
    image: "heroDrivers",
    intro: "Use your small van, SWB, LWB or Luton for local and long-distance jobs, from single items and parcels to house moves. Go online for ASAP work or bid on scheduled jobs.",
    vehicles: ["Small Van", "Short Wheelbase Van", "Long Wheelbase Van", "Luton Van", "Luton Van with Tail Lift"],
    suits: ["Owner-drivers with their own van", "Man and van operators", "Drivers who want ASAP work between planned jobs", "Small removal firms"],
    faqs: [
      { q: "What van do I need?", a: "Any van you can register on your profile, from a small van up to a Luton with tail lift. Jobs are matched to vehicles that suit them." },
      { q: "Can I pick which jobs I do?", a: "Yes. You choose which Bid Jobs to price, which Fixed Price Jobs to accept, and whether to accept ASAP offers when you're online." },
      { q: "Do I need a helper?", a: "Some customers ask for a second person in the job details. You can see this before you bid or accept." },
      DRIVER_DOCS_FAQ,
      DRIVER_PAY_FAQ,
    ],
  },
  {
    slug: "self-employed",
    name: "Self-Employed Drivers",
    h1: "Self-employed courier work",
    image: "heroDrivers",
    intro: "Work for yourself with Cargo One. Choose your hours, set your own prices on Bid Jobs, and go online for ASAP work when it suits you.",
    vehicles: ["Motorcycle Courier", "Small Van", "Long Wheelbase Van", "Luton Van", "Recovery Truck", "7.5 Tonne Lorry"],
    suits: ["Independent couriers", "Drivers building their own transport business", "Part-time drivers fitting work around other commitments", "Drivers who prefer to set their own prices"],
    faqs: [
      { q: "Am I employed by Cargo One?", a: "No. Drivers on Cargo One are independent and responsible for their own vehicle, licence, insurance, tax and legal compliance, as set out in our Terms." },
      { q: "Can I choose my own hours?", a: "Yes. Go online in Live Mode when you want ASAP offers and go offline when you're done. Scheduled jobs are ones you choose to bid on or accept." },
      { q: "Who sets the price?", a: "On Bid Jobs you send your own price. On Fixed Price Jobs and ASAP offers you see the price before you accept." },
      DRIVER_DOCS_FAQ,
      DRIVER_PAY_FAQ,
    ],
  },
  {
    slug: "car-transporters",
    name: "Car Transporters",
    h1: "Car transporter jobs",
    image: "vehicles",
    intro: "Move cars for private buyers, dealers and owners of non-runners. Take scheduled Bid Jobs and Fixed Price Jobs, or go online for ASAP vehicle work.",
    vehicles: ["Car Transporter", "Enclosed Trailer Van", "Light Recovery Van", "Pickup Recovery", "Heavy Recovery / Lowloader"],
    suits: ["Single and multi-car transporter operators", "Enclosed trailer owners moving classic or prestige cars", "Recovery operators with transporter capacity", "Drivers doing trade plate and dealer work"],
    faqs: [
      { q: "What vehicles count as car transport?", a: "Car transporters, enclosed trailer vans and recovery vehicles. Add the vehicles you use to your profile so jobs are matched to them." },
      { q: "Do customers say whether the car runs?", a: "Customers add vehicle details and notes to the job, such as whether it runs or rolls. Read them before you bid or accept." },
      { q: "Can I take long-distance jobs?", a: "Yes. Scheduled Bid Jobs and Fixed Price Jobs can be anywhere in the UK, and you choose which ones to take." },
      DRIVER_DOCS_FAQ,
      DRIVER_PAY_FAQ,
    ],
  },
  {
    slug: "recovery-trucks",
    name: "Recovery Truck Drivers",
    h1: "Work for recovery truck drivers",
    image: "vehicles",
    heroImage: "/images/recovery-truck-hero.webp",
    intro: "Receive ASAP Recovery offers for breakdowns and non-runners 24/7 when you're online, plus scheduled recovery and transport jobs to bid on or accept.",
    vehicles: ["Light Recovery Van", "Pickup Recovery", "Motorcycle Recovery", "3.5T Recovery Truck", "7.5T Recovery Truck", "10–18T Recovery", "26T Recovery", "32T Recovery", "Heavy Recovery / Lowloader", "Heavy Articulated Recovery", "Heavy 6×4 / 8×4 Recovery", "Heavy Tractor Recovery"],
    suits: ["Independent recovery operators", "Garages with a recovery vehicle", "Night and weekend recovery drivers", "Heavy recovery operators"],
    faqs: [
      { q: "How do ASAP Recovery offers reach me?", a: "Go online in Live Mode with a recovery vehicle on your profile. Offers go to online recovery drivers nearby, and the search widens if needed. The first suitable driver to accept gets the job." },
      { q: "Can I work nights and weekends?", a: "Yes. Customers can book 24/7, and you decide when you're online." },
      { q: "Do I see the job before I accept?", a: "Yes. You see the pickup area, drop-off, vehicle details and price before you accept. Full addresses and contact details are shared once the booking is confirmed." },
      DRIVER_DOCS_FAQ,
      DRIVER_PAY_FAQ,
    ],
  },
  {
    slug: "hgv",
    name: "HGV Drivers",
    h1: "HGV driver jobs",
    image: "freight",
    intro: "Use your rigid, curtain-sider, crane or artic for pallets, machinery and bulk loads. Bid on scheduled jobs, accept fixed-price work, or go online for ASAP jobs.",
    vehicles: ["7.5 Tonne Lorry", "18 Tonne Lorry", "Curtain Side Vehicle", "Articulated HGV", "Hiab Crane Vehicle", "Refrigerated Vehicle"],
    suits: ["Owner-operators with a rigid or artic", "Hiab and crane operators", "Hauliers filling return loads", "Refrigerated vehicle operators"],
    faqs: [
      { q: "What licence do I need?", a: "The licence category for the vehicle you drive. Upload your driving licence when you sign up and Cargo One reviews it with your other documents." },
      { q: "Can I use Cargo One for return loads?", a: "Yes. Scheduled Bid Jobs and Fixed Price Jobs show the route before you bid or accept, so you can pick work that fits your journey." },
      { q: "Do customers give load details?", a: "Customers add what they're moving, with weights, sizes and access notes where they can. Check these before you bid." },
      DRIVER_DOCS_FAQ,
      DRIVER_PAY_FAQ,
    ],
  },
];

const city = (slug, name, region, nearby, areas, routes, note, localFaq) => ({ slug, name, region, nearby, areas, routes, note, localFaq });

export const DRIVER_CITIES = [
  city("london", "London", "Greater London", ["Reading", "Brighton", "Southampton"], ["Park Royal", "Canary Wharf", "Croydon", "Stratford", "around Heathrow"], ["M25", "A406 North Circular", "A13", "M4", "M1"],
    "London jobs range from short central drops to runs out along the M25 to the Home Counties.",
    { q: "Do I need to think about ULEZ or the Congestion Charge?", a: "Yes. London's ULEZ and Congestion Charge apply to many vehicles. Check your vehicle on Transport for London's website and factor any charges into your price." }),
  city("birmingham", "Birmingham", "the West Midlands", ["Coventry", "Leicester", "Nottingham", "Stoke-on-Trent"], ["Digbeth", "the Jewellery Quarter", "Aston", "Tyseley", "around the NEC"], ["M6", "M5", "M42", "A38(M) Aston Expressway"],
    "Birmingham sits where the M6, M5 and M42 meet, so many jobs head out across the Midlands and beyond.",
    { q: "Does Birmingham's Clean Air Zone affect me?", a: "It can. The Clean Air Zone covers the roads inside the A4540 Middleway ring road. Check your vehicle on the government's Clean Air Zone checker before taking city-centre jobs." }),
  city("manchester", "Manchester", "Greater Manchester", ["Liverpool", "Leeds", "Sheffield", "Bradford", "Stoke-on-Trent"], ["Trafford Park", "Salford Quays", "Ancoats", "Stockport", "around Manchester Airport"], ["M60", "M62", "M56", "M6"],
    "The M60 ring road links Manchester's industrial estates, and the M62 runs east to Yorkshire and west to Merseyside.",
    { q: "Can I do trans-Pennine jobs from Manchester?", a: "Yes. Bid Jobs and Fixed Price Jobs can run along the M62 to Leeds and Bradford, or over to Sheffield. You choose which ones to take." }),
  city("leeds", "Leeds", "West Yorkshire", ["Bradford", "Sheffield", "Manchester"], ["Leeds city centre", "Cross Green", "Holbeck", "Headingley", "Thorpe Park"], ["M1", "M62", "M621", "A64"],
    "Leeds is where the M1 meets the M62, with jobs across West Yorkshire and out to York along the A64.",
    { q: "Are there student move jobs in Leeds?", a: "Customers post all kinds of moves, including flat and student moves around areas like Headingley. Jobs vary through the year, so check Live Mode and new Bid Jobs regularly." }),
  city("liverpool", "Liverpool", "Merseyside", ["Manchester", "Stoke-on-Trent"], ["the docks at Seaforth and Bootle", "Speke", "the Baltic Triangle", "Knowsley"], ["M62", "M57", "M58", "the Mersey tunnels"],
    "Liverpool work can include runs around the docks, across to the Wirral through the tunnels and east along the M62.",
    { q: "Do I need to pay the Mersey tunnel tolls?", a: "The Queensway and Kingsway tunnels charge tolls. If a job uses them, include the cost in your price." }),
  city("sheffield", "Sheffield", "South Yorkshire", ["Leeds", "Nottingham", "Manchester", "Bradford"], ["Meadowhall", "the Lower Don Valley", "Kelham Island", "Hillsborough"], ["M1", "Sheffield Parkway", "A61", "A57"],
    "Sheffield sits beside the M1, with routes west over the Pennines towards Manchester.",
    { q: "Are hilly routes a problem for heavier vehicles?", a: "Sheffield and the Pennine routes are hilly. Read the access notes and check your route before you bid on heavier loads." }),
  city("bristol", "Bristol", "the South West", ["Cardiff", "Reading", "Southampton"], ["Avonmouth", "Temple Meads", "Cribbs Causeway", "Clifton"], ["M5", "M4", "M32", "M49"],
    "Bristol connects the M5 and M4, so work can head into South Wales, London and the South West.",
    { q: "Does Bristol's Clean Air Zone affect me?", a: "It can. Bristol has a Clean Air Zone in the city centre. Check your vehicle on the government's Clean Air Zone checker before taking central jobs." }),
  city("newcastle", "Newcastle", "the North East", ["Edinburgh", "Leeds"], ["the Quayside", "Team Valley in Gateshead", "around the Metrocentre", "Cobalt Business Park"], ["A1(M)", "A19", "A69", "the Tyne Tunnel"],
    "Newcastle jobs run along the A1 and A19 across Tyne and Wear, with longer runs north to Scotland and south to Yorkshire.",
    { q: "Does Newcastle have a Clean Air Zone?", a: "Yes, there's a Clean Air Zone in the city centre. Check your vehicle on the government's Clean Air Zone checker before taking central jobs." }),
  city("nottingham", "Nottingham", "the East Midlands", ["Leicester", "Sheffield", "Birmingham", "Coventry"], ["the Lace Market", "Beeston", "Colwick", "around East Midlands Airport"], ["M1", "A52", "A453", "A610"],
    "Nottingham sits between the M1 and the A52, close to the East Midlands logistics corridor.",
    { q: "Can I take jobs between Nottingham and Leicester?", a: "Yes. Bid Jobs and Fixed Price Jobs can be anywhere, and runs along the M1 corridor are one option. You choose which ones to take." }),
  city("leicester", "Leicester", "the East Midlands", ["Nottingham", "Coventry", "Birmingham"], ["Leicester city centre", "Fosse Park", "Beaumont Leys", "around Magna Park near Lutterworth"], ["M1", "M69", "A46", "A6"],
    "Leicester is close to the Midlands distribution parks, with the M1 and M69 a short drive away.",
    { q: "Is there warehouse and pallet work near Leicester?", a: "Customers post pallet and freight jobs too, and Leicester is near several large distribution parks. Check new Bid Jobs and Fixed Price Jobs for work that fits your vehicle." }),
  city("glasgow", "Glasgow", "Scotland", ["Edinburgh"], ["the Merchant City", "Finnieston", "Hillington Park", "the Clyde waterfront"], ["M8", "M74", "M77", "M80"],
    "Glasgow jobs connect the M8 to Edinburgh, the M74 south and the M80 north.",
    { q: "Does Glasgow's Low Emission Zone affect me?", a: "It can. Glasgow has a Low Emission Zone in the city centre. Check your vehicle meets the rules before taking central jobs." }),
  city("edinburgh", "Edinburgh", "Scotland", ["Glasgow", "Newcastle"], ["Leith", "the Old Town", "Sighthill", "Newbridge", "around Edinburgh Airport"], ["A720 City Bypass", "M8", "M9", "A1"],
    "Edinburgh work runs around the City Bypass, west along the M8 and south down the A1.",
    { q: "Does Edinburgh's Low Emission Zone affect me?", a: "It can. Edinburgh has a Low Emission Zone in the city centre. Check your vehicle meets the rules before taking central jobs." }),
  city("cardiff", "Cardiff", "South Wales", ["Bristol"], ["Cardiff Bay", "Splott", "Cardiff city centre", "Wentloog"], ["M4", "A470", "A48(M)", "A4232"],
    "Cardiff jobs run along the M4 to Bristol and up the A470 into the valleys.",
    { q: "Can I take jobs over the Severn bridges?", a: "Yes. Runs between Cardiff and Bristol along the M4 are common routes. You choose which jobs to take." }),
  city("belfast", "Belfast", "Northern Ireland", [], ["Belfast Harbour", "the Titanic Quarter", "Duncrue", "Boucher Road"], ["M1", "M2", "A2", "the Westlink"],
    "Belfast work covers the harbour, city and routes out along the M1 and M2 to Lisburn, Newtownabbey and beyond.",
    { q: "Can I drive for Cargo One in Northern Ireland?", a: "Yes. Sign up with your documents in the usual way. Once they're approved you can go online and take jobs around Belfast and across Northern Ireland." }),
  city("coventry", "Coventry", "the West Midlands", ["Birmingham", "Leicester", "Nottingham"], ["Coventry city centre", "Ansty Park", "Ryton", "Whitley"], ["A45", "A46", "M6", "M69"],
    "Coventry sits between the M6, M69 and A45, close to Birmingham and Leicester.",
    { q: "Is Coventry a good base for Midlands work?", a: "Coventry is close to the M6, M69 and A45, so Midlands jobs are within reach. You choose which jobs to bid on or accept." }),
  city("bradford", "Bradford", "West Yorkshire", ["Leeds", "Manchester", "Sheffield"], ["Bradford city centre", "Euroway", "Shipley", "Keighley"], ["M606", "M62", "A650", "A647"],
    "Bradford links to the M62 via the M606, with Leeds just a few miles east.",
    { q: "Does Bradford have a Clean Air Zone?", a: "Yes. Bradford has a Clean Air Zone. Check your vehicle on the government's Clean Air Zone checker before taking jobs inside it." }),
  city("stoke-on-trent", "Stoke-on-Trent", "Staffordshire", ["Manchester", "Birmingham", "Liverpool"], ["Hanley", "Etruria", "Trentham Lakes", "Burslem", "Longton"], ["A500", "M6", "A50", "A53"],
    "Stoke-on-Trent is made up of six towns linked by the A500, with the M6 running alongside.",
    { q: "Can I reach Manchester and Birmingham jobs from Stoke?", a: "Stoke sits on the M6 between the two, so jobs in either direction are an option. You choose which ones to take." }),
  city("southampton", "Southampton", "Hampshire", ["Reading", "Brighton", "Bristol", "London"], ["the docks", "Southampton city centre", "Nursling", "Hedge End"], ["M27", "M3", "A33", "A36"],
    "Southampton jobs can include runs around the port and along the M27 and M3.",
    { q: "Are there port-related jobs in Southampton?", a: "Customers post all kinds of jobs, which can include collections near the port. Read the access notes on any job near the docks before you bid." }),
  city("reading", "Reading", "Berkshire", ["London", "Southampton", "Bristol"], ["Green Park", "Reading town centre", "Theale", "Thames Valley Park"], ["M4", "A33", "A329(M)", "A4"],
    "Reading sits on the M4 between London and Bristol, with the A33 heading south to the M3.",
    { q: "Can I take London jobs from Reading?", a: "Yes. The M4 links Reading to West London, and you choose which jobs to bid on or accept." }),
  city("brighton", "Brighton", "East Sussex", ["London", "Southampton"], ["the North Laine", "Hove", "Shoreham Port", "Hollingbury"], ["A23", "M23", "A27", "A259"],
    "Brighton work runs along the coast on the A27 and A259, and north to London on the A23 and M23.",
    { q: "Is parking hard for jobs in central Brighton?", a: "Central Brighton has a lot of controlled parking. Check the access notes and plan where you'll stop before you bid." }),
];

export const DRIVER_TYPE_BY_SLUG = Object.fromEntries(DRIVER_TYPES.map((d) => [d.slug, d]));
export const DRIVER_CITY_BY_SLUG = Object.fromEntries(DRIVER_CITIES.map((c) => [c.slug, c]));
export const DRIVER_CITY_BY_NAME = Object.fromEntries(DRIVER_CITIES.map((c) => [c.name, c]));

export function cityFaqs(c) {
  const nearby = c.nearby.length ? `, and runs to places like ${c.nearby.slice(0, 3).join(", ")}` : "";
  return [
    { q: `Can I drive for Cargo One in ${c.name}?`, a: `Yes. Once your documents are approved you can go online in Live Mode in ${c.name} and across ${c.region}, and bid on or accept scheduled jobs.` },
    { q: `What kind of jobs can I take around ${c.name}?`, a: `Customers can post jobs anywhere in and around ${c.name}, including ${c.areas.slice(0, 3).join(", ")}. Work includes ASAP Transport, ASAP Recovery, Bid Jobs and Fixed Price Jobs${nearby}.` },
    c.localFaq,
    DRIVER_DOCS_FAQ,
    DRIVER_PAY_FAQ,
  ];
}

export function driverTypeSeo(d) {
  return {
    path: `/drivers/${d.slug}`,
    title: `${d.h1} | Drive with Cargo One`,
    h1: d.h1,
    description: `${d.intro.split(". ")[0].replace(/\.$/, "")}. Sign up to drive with Cargo One.`,
  };
}

export function driverCitySeo(c) {
  return {
    path: `/drivers/jobs/${c.slug}`,
    title: `Courier & Driver Jobs in ${c.name} | Cargo One`,
    h1: `Courier jobs in ${c.name}`,
    intro: `Find courier, delivery and recovery work in ${c.name} and across ${c.region}. ${c.note}`,
    description: `Drive with Cargo One in ${c.name} and ${c.region}: ASAP Transport and ASAP Recovery 24/7 in Live Mode, plus Bid Jobs and Fixed Price Jobs.`,
  };
}

export function driverJsonLd(seo, faqs, crumbs) {
  return [faqJsonLd(faqs), breadcrumbJsonLd([["Home", "/"], ["Drivers", "/drivers"], ...crumbs, [seo.h1, seo.path]])];
}

// ---------- Local SEO Wave 1: /couriers/{city} hubs and /services/{service}/{city} ----------
const GOV_CAZ = "https://www.gov.uk/clean-air-zones";

export const LOCAL_CITIES = [
  {
    slug: "london", name: "London", region: "Greater London",
    residential: ["Clapham", "Islington", "Hackney", "Wandsworth", "Ealing", "Walthamstow"],
    retail: ["Westfield White City", "Westfield Stratford City", "Camden Market", "Brent Cross"],
    business: ["the City of London", "Canary Wharf", "Shoreditch", "King's Cross"],
    industrial: ["Park Royal", "Barking", "Brimsdown in Enfield", "the area around Heathrow"],
    roads: ["M25", "A406 North Circular", "A13", "A40 Westway"],
    water: ["Limehouse Basin", "Chelsea Harbour", "the Thames at Brentford", "Little Venice on the Regent's Canal"],
    parking: "Most London streets have controlled parking and many main roads are red routes, so plan where the driver can load before you book.",
    cleanAir: { text: "London has the ULEZ across all boroughs and the Congestion Charge in central London. Check whether your vehicle is affected.", url: "https://tfl.gov.uk/modes/driving/ultra-low-emission-zone", label: "TfL ULEZ checker" },
    character: "From mansion-block flats in the centre to suburban semis inside the M25, London jobs vary hugely in access and distance.",
  },
  {
    slug: "birmingham", name: "Birmingham", region: "the West Midlands",
    residential: ["Moseley", "Harborne", "Edgbaston", "Kings Heath", "Sutton Coldfield", "Erdington"],
    retail: ["the Bullring", "the Mailbox", "Fort Shopping Park", "the Custard Factory"],
    business: ["Colmore Business District", "Brindleyplace", "Paradise", "Snow Hill"],
    industrial: ["Tyseley", "Aston", "Minworth", "Hams Hall"],
    roads: ["M6 at Spaghetti Junction", "M5", "M42", "A38(M) Aston Expressway"],
    water: ["Gas Street Basin", "the Birmingham Canal Navigations", "the Grand Union Canal", "the Worcester and Birmingham Canal"],
    parking: "Loading inside the A4540 Middleway ring road is limited, while suburbs like Moseley and Harborne are usually easier to park in.",
    cleanAir: { text: "Birmingham has a Clean Air Zone in the city centre, inside the A4540 Middleway. Check whether your vehicle is affected.", url: GOV_CAZ, label: "GOV.UK Clean Air Zone checker" },
    character: "Birmingham sits at the heart of the motorway network, so local jobs and longer Midlands runs are both common.",
  },
  {
    slug: "manchester", name: "Manchester", region: "Greater Manchester",
    residential: ["Didsbury", "Chorlton", "Levenshulme", "Fallowfield", "Prestwich", "Sale"],
    retail: ["the Trafford Centre", "the Arndale", "Manchester Fort Shopping Park", "the Northern Quarter"],
    business: ["Spinningfields", "Piccadilly", "MediaCityUK", "St Peter's Square"],
    industrial: ["Trafford Park", "Openshaw", "Newton Heath", "the area around Manchester Airport"],
    roads: ["M60", "M62", "M56", "M602"],
    water: ["Castlefield Basin", "the Bridgewater Canal", "the Rochdale Canal", "Salford Quays"],
    parking: "Loading space is tight in the Northern Quarter and Ancoats, and Metrolink tram lines run through the city centre.",
    cleanAir: null,
    character: "The M60 ring road ties Manchester's suburbs and industrial estates together, with the M62 heading east and west.",
  },
  {
    slug: "leeds", name: "Leeds", region: "West Yorkshire",
    residential: ["Headingley", "Chapel Allerton", "Roundhay", "Horsforth", "Kirkstall", "Meanwood"],
    retail: ["Trinity Leeds", "the Victoria Quarter", "the White Rose Centre", "Kirkgate Market"],
    business: ["Wellington Place", "the South Bank", "Park Square", "Leeds Dock"],
    industrial: ["Cross Green", "Stourton", "Thorpe Park", "Holbeck"],
    roads: ["M1", "M62", "M621", "A64"],
    water: ["Leeds Dock", "Granary Wharf", "the Leeds and Liverpool Canal", "the Aire and Calder Navigation"],
    parking: "The city-centre loop and inner ring road limit where vehicles can stop, and student areas like Headingley have busy terraced streets.",
    cleanAir: null,
    character: "Leeds is where the M1 meets the M62, with terraced suburbs, a compact centre and big distribution sites to the south.",
  },
  {
    slug: "glasgow", name: "Glasgow", region: "the west of Scotland",
    residential: ["the West End", "Shawlands", "Dennistoun", "Partick", "Bearsden", "Govanhill"],
    retail: ["Buchanan Galleries", "St Enoch Centre", "Silverburn", "Braehead"],
    business: ["the International Financial Services District", "the Merchant City", "Blythswood Square", "Finnieston"],
    industrial: ["Hillington Park", "Queenslie", "the Clyde Gateway", "Eurocentral"],
    roads: ["M8", "M74", "M77", "M80"],
    water: ["the River Clyde", "the Forth and Clyde Canal", "Spiers Wharf", "marinas on the Firth of Clyde"],
    parking: "Many tenement streets have controlled parking and shared closes, and the city centre has bus gates to watch for.",
    cleanAir: { text: "Glasgow has a Low Emission Zone in the city centre. Check whether your vehicle is affected.", url: "https://www.lowemissionzones.scot/", label: "Low Emission Zones Scotland" },
    character: "Glasgow's tenement flats, busy centre and Clyde-side industry make access details especially important.",
  },
  {
    slug: "liverpool", name: "Liverpool", region: "Merseyside",
    residential: ["Allerton", "Wavertree", "Woolton", "Crosby", "Aigburth", "West Derby"],
    retail: ["Liverpool ONE", "Bold Street", "the Edge Lane retail parks", "the Baltic Market"],
    business: ["the Commercial District", "the Royal Albert Dock", "the Baltic Triangle", "the Knowledge Quarter"],
    industrial: ["Speke", "Knowsley Industrial Park", "Seaforth", "Bootle"],
    roads: ["M62", "M57", "M58", "the Mersey tunnels"],
    water: ["the Royal Albert Dock", "Liverpool Marina", "the Leeds and Liverpool Canal", "the River Mersey"],
    parking: "Streets around Liverpool ONE have limited loading, and trips to the Wirral use the tolled Mersey tunnels.",
    cleanAir: null,
    character: "Liverpool mixes docklands, a busy waterfront centre and leafy southern suburbs, all linked to the M62.",
  },
  {
    slug: "newcastle", name: "Newcastle", region: "Tyne and Wear",
    residential: ["Jesmond", "Gosforth", "Heaton", "Fenham", "Whitley Bay", "Tynemouth"],
    retail: ["Eldon Square", "the Metrocentre", "Grainger Market", "Silverlink"],
    business: ["the Quayside", "Newcastle Helix", "the area around Central Station", "Cobalt Business Park"],
    industrial: ["Team Valley", "the Port of Tyne", "Benton", "Follingsby"],
    roads: ["A1 Western Bypass", "A19", "A69", "the Tyne Tunnel"],
    water: ["Royal Quays Marina", "St Peter's Marina", "the River Tyne", "the Port of Tyne"],
    parking: "Jesmond and Heaton have resident permit zones, and the Tyne Tunnel is tolled for crossings.",
    cleanAir: { text: "Newcastle has a Clean Air Zone in the city centre. Check whether your vehicle is affected.", url: GOV_CAZ, label: "GOV.UK Clean Air Zone checker" },
    character: "Newcastle jobs run either side of the Tyne, from Gateshead's Team Valley to the coast at Tynemouth.",
  },
  {
    slug: "sheffield", name: "Sheffield", region: "South Yorkshire",
    residential: ["Crookes", "Ecclesall", "Walkley", "Nether Edge", "Hillsborough", "Broomhill"],
    retail: ["Meadowhall", "Fargate", "the Moor Market", "Crystal Peaks"],
    business: ["Kelham Island", "the Heart of the City", "the Cultural Industries Quarter", "Sheffield Business Park"],
    industrial: ["the Lower Don Valley", "Attercliffe", "Tinsley", "the Advanced Manufacturing Park"],
    roads: ["M1 at Tinsley Viaduct", "Sheffield Parkway", "A61", "A57 Snake Pass"],
    water: ["Victoria Quays", "the Sheffield and Tinsley Canal", "the River Don"],
    parking: "Steep hills in Crookes and Walkley and narrow terraced streets mean access is worth checking before the day.",
    cleanAir: { text: "Sheffield has a Clean Air Zone in and around the city centre. Check whether your vehicle is affected.", url: GOV_CAZ, label: "GOV.UK Clean Air Zone checker" },
    character: "Sheffield is built on seven hills, with steelmaking heritage in the Don Valley and the Peak District on its doorstep.",
  },
  {
    slug: "bristol", name: "Bristol", region: "the South West",
    residential: ["Clifton", "Redland", "Bedminster", "Southville", "Bishopston", "Fishponds"],
    retail: ["Cabot Circus", "Cribbs Causeway", "Broadmead", "St Nicholas Market"],
    business: ["Temple Quarter", "Harbourside", "Redcliffe", "Aztec West"],
    industrial: ["Avonmouth", "St Philips Marsh", "Severnside", "Emersons Green"],
    roads: ["M5 at the Avonmouth Bridge", "M4/M5 Almondsbury interchange", "M32", "A4 Portway"],
    water: ["the Floating Harbour", "Bristol Marina", "Portishead Marina", "the Feeder Canal"],
    parking: "Residents' parking zones cover much of central Bristol, and Clifton's streets are steep and narrow.",
    cleanAir: { text: "Bristol has a Clean Air Zone in the city centre. Check whether your vehicle is affected.", url: GOV_CAZ, label: "GOV.UK Clean Air Zone checker" },
    character: "Bristol's harbourside centre, hilly suburbs and the Avonmouth docks each bring different access needs.",
  },
  {
    slug: "nottingham", name: "Nottingham", region: "the East Midlands",
    residential: ["West Bridgford", "Beeston", "Mapperley", "Sherwood", "Arnold", "Lenton"],
    retail: ["the Victoria Centre", "Hockley", "Castle Marina Retail Park", "Riverside Retail Park"],
    business: ["the Lace Market", "Castle Wharf", "Nottingham Science Park", "Trent Basin"],
    industrial: ["Colwick", "Bulwell", "Sherwood Business Park", "the area around East Midlands Airport"],
    roads: ["M1 junctions 24 to 27", "A52", "A610", "the A6514 Ring Road"],
    water: ["Castle Marina", "the Nottingham Canal", "the River Trent", "Trent Lock"],
    parking: "Tram lines and bus lanes in the city centre limit where vehicles can stop, while suburbs like West Bridgford are easier.",
    cleanAir: null,
    character: "Nottingham sits between the M1 and the River Trent, with student areas, a historic centre and busy retail parks.",
  },
];

const ROUTE_ROADS = {
  "birmingham-london": "M40 or M1 and M6", "london-manchester": "M1 and M6", "leeds-london": "M1", "bristol-london": "M4",
  "london-nottingham": "M1", "london-sheffield": "M1", "liverpool-london": "M1 and M6", "london-newcastle": "A1(M)",
  "birmingham-manchester": "M6", "birmingham-bristol": "M5", "birmingham-nottingham": "M42 and M1", "birmingham-liverpool": "M6",
  "birmingham-leeds": "M42 and M1", "birmingham-sheffield": "M42 and M1", "leeds-manchester": "M62", "liverpool-manchester": "M62",
  "manchester-sheffield": "A57 or A628 over the Pennines", "glasgow-manchester": "M6 and M74", "manchester-newcastle": "M62 and A1(M)",
  "bristol-manchester": "M5 and M6", "leeds-sheffield": "M1", "leeds-newcastle": "A1(M)", "leeds-liverpool": "M62",
  "leeds-nottingham": "M1", "glasgow-newcastle": "M74, M6 and A69", "glasgow-liverpool": "M74 and M6",
  "newcastle-sheffield": "A1(M) and M1", "nottingham-sheffield": "M1", "liverpool-sheffield": "M62 and M1",
  "bristol-nottingham": "M5, M42 and M1", "bristol-liverpool": "M5 and M6", "liverpool-newcastle": "M62 and A1(M)",
};

export const LOCAL_CITY_BY_SLUG = Object.fromEntries(LOCAL_CITIES.map((c) => [c.slug, c]));

export function cityRoutes(c) {
  return LOCAL_CITIES.filter((o) => o.slug !== c.slug)
    .map((o) => ({ to: o, roads: ROUTE_ROADS[[c.slug, o.slug].sort().join("-")] }))
    .filter((r) => r.roads);
}

const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0]);

// Which local facts each service uses, and how it describes them.
const SERVICE_LOCAL = {
  "man-and-van": { facet: "residential", lead: (c, a) => `Our ${c.name} man and van drivers work in flats and houses across ${list(a)}, as well as the city centre. Small moves, single items and tip runs can all be booked.` },
  "furniture-delivery": { facet: "retail", lead: (c, a) => `Bought a sofa or wardrobe at ${list(a)}? Book a driver to collect it from the store or a seller and deliver it to homes anywhere in ${c.name}.` },
  "same-day-courier": { facet: "business", lead: (c, a) => `Same-day courier jobs in ${c.name} often start in business areas like ${list(a)}. Book ASAP for an urgent run or schedule it for later today.` },
  "house-removals": { facet: "residential", lead: (c, a) => `Moving home in ${c.name}? Drivers cover areas like ${list(a)}, with vans and lorries for everything from studio flats to family homes.` },
  "car-transport": { facet: "roads", lead: (c, a) => `Car transport in ${c.name} covers private sales, dealer moves and non-runners, with transporters using routes like the ${list(a)}.` },
  "vehicle-recovery": { facet: "roads", lead: (c, a) => `Breakdowns around ${c.name} often happen on busy roads like the ${list(a)}. Book 24/7 and ASAP Recovery jobs go to recovery drivers available around the clock nearby.` },
  "motorbike-transport": { facet: "residential", lead: (c, a) => `Move a motorbike, scooter or moped to or from homes in ${list(a)}, a ${c.name} workshop or an event, strapped down on a suitable vehicle.` },
  "pallet-delivery": { facet: "industrial", lead: (c, a) => `Pallet jobs in ${c.name} often run to and from industrial areas like ${list(a)}, using tail-lift vans and lorries.` },
  "marketplace-collection": { facet: "retail", lead: (c, a) => `Found something on a marketplace in ${c.name}? Drivers can collect from sellers across the city, from shopping areas like ${list(a)} to private homes.` },
  "parcel-delivery": { facet: "business", lead: (c, a) => `Send parcels and boxes across ${c.name}, from offices in ${list(a)} to homes in the suburbs, booked ASAP or scheduled.` },
  "boat-transport": { facet: "water", lead: (c, a) => `Moving a boat in or out of ${c.name}? Local waters include ${list(a)}. Boats and trailers can be moved between home, storage, slipways and marinas.` },
  "machinery-haulage": { facet: "industrial", lead: (c, a) => `Move plant, machinery and workshop equipment to and from sites in ${c.name}, including industrial areas like ${list(a)}.` },
};

export function localService(service, c) {
  const svcIdx = SERVICE_PAGES.findIndex((s) => s.slug === service.slug);
  const cfg = SERVICE_LOCAL[service.slug];
  const pool = cfg.facet === "roads" ? c.residential : c[cfg.facet];
  const areas = pool.map((_, i) => pool[(i + svcIdx) % pool.length]);
  const allRoutes = cityRoutes(c);
  const routes = [0, 1, 2].map((i) => allRoutes[(svcIdx + i) % allRoutes.length]);
  const lead = cfg.lead(c, (cfg.facet === "roads" ? c.roads : areas).slice(0, 4));
  const access = [c.parking, ...(cfg.facet === "roads" ? [] : [`Main roads for ${service.name.toLowerCase()} jobs include the ${list(c.roads.slice(0, 3))}.`])];
  const pick = [svcIdx % 5, (svcIdx + 2) % 5].map((i) => service.faqs[i]);
  const faqs = [
    { q: `Which parts of ${c.name} do you cover for ${service.name.toLowerCase()}?`, a: `Anywhere in ${c.name} and across ${c.region}, including ${list(areas.slice(0, 3))}. Enter your pickup and drop-off to see your price.` },
    { q: `Is there anything to know about access in ${c.name}?`, a: `${c.parking}${c.cleanAir ? ` ${c.cleanAir.text}` : ""} Add access notes to your job so drivers can come prepared.` },
    { q: `Can I book ${service.name.toLowerCase()} from ${c.name} to ${routes[0].to.name}?`, a: `Yes. ${c.name} to ${routes[0].to.name} jobs usually use the ${routes[0].roads}. Book ASAP or schedule it as a Bid Job or Fixed Price Job.` },
    ...pick,
  ];
  return { areas, routes, lead, access, faqs };
}

export function serviceCitySeo(service, c) {
  const { areas } = localService(service, c);
  return {
    path: `/services/${service.slug}/${c.slug}`,
    title: `${service.name} in ${c.name} – Instant Quote | Cargo One`,
    h1: `${service.name} in ${c.name} – instant quote`,
    description: `${service.name} in ${c.name}, including ${list(areas.slice(0, 2))}. Get an instant quote, book a verified driver and track it live.`,
  };
}

export function serviceCityJsonLd(service, c, faqs) {
  return [
    faqJsonLd(faqs),
    breadcrumbJsonLd([["Home", "/"], ["Services", "/services"], [service.name, `/services/${service.slug}`], [c.name, `/services/${service.slug}/${c.slug}`]]),
  ];
}

export function cityHubFaqs(c) {
  const r = cityRoutes(c);
  return [
    { q: `Which areas of ${c.name} do you cover?`, a: `All of ${c.name} and ${c.region}, from homes in ${list(c.residential.slice(0, 3))} to business and industrial areas like ${list([c.business[0], c.industrial[0]])}.` },
    { q: `Can I book a courier in ${c.name} right now?`, a: `Yes. You can book 24/7. ASAP Transport and ASAP Recovery jobs go to drivers available around the clock near the pickup, and you can follow your driver live once one accepts.` },
    { q: `What should I know about parking and access in ${c.name}?`, a: `${c.parking}${c.cleanAir ? ` ${c.cleanAir.text}` : ""}` },
    { q: `Do you do longer journeys from ${c.name}?`, a: `Yes. Popular runs include ${list(r.slice(0, 3).map((x) => `${x.to.name} via the ${x.roads}`))}.` },
    { q: `Which booking types can I use in ${c.name}?`, a: "ASAP Transport, ASAP Recovery, Bid Jobs and Fixed Price Jobs are all available. Choose the one that fits when you book." },
  ];
}

export function cityHubSeo(c) {
  return {
    path: `/couriers/${c.slug}`,
    title: `Couriers & Man and Van in ${c.name} – Instant Quote | Cargo One`,
    h1: `Couriers and man and van in ${c.name}`,
    intro: `${c.character} Get an instant quote for any job in ${c.name} and ${c.region}, book 24/7, and track your verified driver live.`,
    description: `Couriers, man and van, removals, recovery and more in ${c.name} and ${c.region}. Instant quote, book 24/7 and track your driver live.`,
  };
}

export function cityHubJsonLd(c, faqs) {
  return [faqJsonLd(faqs), breadcrumbJsonLd([["Home", "/"], ["Couriers", "/couriers"], [c.name, `/couriers/${c.slug}`]])];
}

export const COURIERS_INDEX_SEO = {
  path: "/couriers",
  title: "Couriers & Man and Van by City | Cargo One",
  h1: "Couriers and man and van by city",
  description: "Find couriers, man and van, removals and vehicle recovery in major UK cities. Instant quote, book 24/7 and track your driver live.",
};
