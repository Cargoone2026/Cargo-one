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

// ---------- SEO Phase 3 · Batch 2: extra national service pages (/services/{slug}) ----------
// Kept separate from SERVICE_PAGES so the existing /services index and Wave 1 hubs are unchanged.
const VEHICLE_FAQ_TRACK = { q: "Can I track it?", a: "Yes. Once the driver sets off you can follow them on the map, and you'll get photo proof at delivery." };

export const EXTRA_SERVICE_PAGES = [
  {
    slug: "non-runner-car-transport", name: "Non-Runner Car Transport", heroImage: "/images/recovery-truck-hero.webp", image: "vehicles", recovery247: true,
    intro: "Move a car that won't start, won't drive or isn't road legal, from a driveway, garage, car park or yard. Book 24/7 as an ASAP job, an open bid or a fixed-price booking.",
    moves: ["Cars that won't start", "SORN and untaxed vehicles", "Project and restoration cars", "Cars with flat tyres or seized brakes", "Cars going for repair or scrap", "Vehicles with no keys"],
    vehicles: ["Light Recovery Van", "Pickup Recovery", "3.5T Recovery Truck", "Car Transporter", "Heavy Recovery / Lowloader"],
    related: ["vehicle-recovery", "car-transport", "classic-car-transport"],
    faqs: [
      { q: "What counts as a non-runner?", a: "Any vehicle that can't be driven onto the truck, for example one that won't start, has no keys, or has damaged wheels or brakes." },
      { q: "Will the driver have a winch?", a: "Say in the job whether the car rolls, steers and brakes. Drivers can then bring a winch, skates or a second person if needed." },
      { q: "Can you collect from a tight driveway or underground car park?", a: "Add access notes, including height limits and space to load. Drivers see this before they accept, so they can bring a suitable vehicle." },
      { q: "Can I book a non-runner collection right now?", a: "Yes. You can book 24/7. Choose ASAP and your job goes to recovery drivers available near the pickup, or schedule it for a date that suits you." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "classic-car-transport", name: "Classic Car Transport", image: "vehicles",
    intro: "Move a classic, vintage or prestige car to a show, a restorer, a new owner or storage, on an open transporter or an enclosed trailer.",
    moves: ["Classic and vintage cars", "Prestige and sports cars", "Cars going to shows and auctions", "Restoration projects", "Cars going into or out of storage", "Low-clearance vehicles"],
    vehicles: ["Enclosed Trailer Van", "Car Transporter", "Flatbed Truck"],
    related: ["car-transport", "non-runner-car-transport", "vehicle-recovery"],
    faqs: [
      { q: "Can I ask for enclosed transport?", a: "Yes. Choose an enclosed trailer or say so in the job, and only drivers with a suitable vehicle can take it." },
      { q: "My car is low. Will that be a problem?", a: "Add the ground clearance and any spoilers or splitters in the notes so drivers can bring suitable ramps." },
      { q: "Can you deliver to a show or auction?", a: "Yes. Add the venue's address, the arrival time and any entry reference the organisers have given you." },
      { q: "What if the car doesn't run?", a: "Say so in the job. Drivers with a winch can be matched to it." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "van-transport", name: "Van Transport", image: "vans", heroImage: "/images/van-road-hero.webp",
    intro: "Move a van without driving it, whether you've bought one online, need a fleet vehicle moved or have a van that won't run.",
    moves: ["Small and medium vans", "Long wheelbase vans", "Luton and box vans", "Campervan conversions", "Fleet and company vans", "Non-running vans"],
    vehicles: ["Car Transporter", "3.5T Recovery Truck", "7.5T Recovery Truck", "Heavy Recovery / Lowloader"],
    related: ["car-transport", "non-runner-car-transport", "vehicle-recovery"],
    faqs: [
      { q: "What details do I need to give?", a: "The make and model, its rough size and weight, whether it runs, and any access limits at pickup or drop-off." },
      { q: "Can you move a loaded van?", a: "Tell us if anything is inside and how heavy it is. It's usually best to empty the van before it's moved." },
      { q: "Can you collect from a dealer or auction?", a: "Yes. Add the collection address and any release reference the site needs." },
      { q: "Can I book van transport at short notice?", a: "Yes. Choose ASAP and your job goes to nearby drivers who are online, or schedule it for later." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "caravan-transport", name: "Caravan Transport", image: "caravans",
    intro: "Get a touring caravan towed between home, storage, a dealer, a workshop or a site by a driver with a suitable tow vehicle.",
    moves: ["Touring caravans", "Caravans bought privately or from a dealer", "Moves to and from storage", "Trips to service and repair workshops", "Moves to holiday parks and sites", "Trailer tents and folding campers"],
    vehicles: ["Caravan Transport", "Other (tow vehicle with trailer)"],
    related: ["static-caravan-transport", "horsebox-and-trailer-transport", "car-transport"],
    faqs: [
      { q: "What details do you need?", a: "The caravan's length, its weight, the type of hitch, and access details at both ends." },
      { q: "Does the caravan need to be roadworthy?", a: "For towing, the caravan's tyres, brakes and lights need to be safe to use. If they aren't, say so and describe the problem so a suitable driver can take the job." },
      { q: "Can you collect from a storage site?", a: "Yes. Add the site name, opening times and any gate codes or booking reference the driver needs." },
      { q: "Should I empty the caravan first?", a: "Secure or remove loose items and close all windows, vents and roof lights before the driver arrives." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "static-caravan-transport", name: "Static Caravan Transport", image: "static_caravans",
    intro: "Move a static caravan or holiday lodge between parks, dealers and private land, with a driver and vehicle suited to the size and access.",
    moves: ["Static caravans", "Holiday homes", "Moves between holiday parks", "Deliveries from dealers", "Moves onto private land", "Removals for replacement"],
    vehicles: ["Static Caravan Transport", "Flatbed Truck", "Heavy Recovery / Lowloader"],
    related: ["caravan-transport", "machinery-haulage", "freight-and-haulage"],
    faqs: [
      { q: "What do I need to tell you?", a: "The length, width and weight if you know it, plus access details at both sites, including gates, slopes and overhead cables." },
      { q: "Who prepares the caravan for the move?", a: "Disconnecting services, removing skirting and preparing the caravan is usually arranged with the park. Check with them and add what's been done to the job." },
      { q: "Can you move very wide units?", a: "Wide units may need extra planning, permits or escorts. Contact us first so we can check what's possible." },
      { q: "Can the park help on the day?", a: "Add a contact at each park and any times you're allowed to move, so the driver can plan around them." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "horsebox-and-trailer-transport", name: "Horsebox and Trailer Transport", image: "vehicles",
    intro: "Have a horse trailer, horsebox or general-purpose trailer towed or carried between home, a yard, a dealer or a workshop.",
    moves: ["Horse trailers", "Small horseboxes", "Car and plant trailers", "Box and livestock trailers", "Trailers bought privately", "Non-running horseboxes"],
    vehicles: ["Other (tow vehicle with trailer)", "Flatbed Truck", "3.5T Recovery Truck", "7.5T Recovery Truck", "Heavy Recovery / Lowloader"],
    related: ["caravan-transport", "vehicle-recovery", "agricultural-machinery-transport"],
    faqs: [
      { q: "Do you move animals?", a: "This service is for moving the horsebox or trailer itself. If you need animals moved, contact us first." },
      { q: "What details do you need?", a: "The type of trailer or horsebox, its size and weight, the hitch type, and whether it runs or rolls." },
      { q: "Can you move a horsebox that won't start?", a: "Yes. Say so in the job and add its size and weight so a recovery driver with a suitable vehicle can take it." },
      { q: "Can you collect from a yard or field?", a: "Add access notes, including the ground conditions and gate widths, so the driver can bring a suitable vehicle." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "single-item-delivery", name: "Single Item Delivery", image: "single_items",
    intro: "Move one large or awkward item, like a sofa, fridge, wardrobe or piano stool, without booking a full removal.",
    moves: ["Sofas and armchairs", "Fridges, freezers and washing machines", "Beds and mattresses", "Wardrobes and cabinets", "Bikes and gym equipment", "Items too big for a parcel courier"],
    vehicles: ["Small Van", "Short Wheelbase Van", "Long Wheelbase Van", "Luton Van"],
    related: ["man-and-van", "furniture-delivery", "marketplace-collection"],
    faqs: [
      { q: "Will the driver carry it in?", a: "Say whether you need help carrying, and how many floors and stairs there are, so drivers can plan the right help." },
      { q: "How do I describe the item?", a: "Add its size, rough weight and a photo if you can. This helps match a vehicle that fits it." },
      { q: "Can I book for today?", a: "Yes. Choose ASAP and your job goes to nearby drivers who are online, or pick a date and time." },
      { q: "Can you collect from a shop?", a: "Yes. Add the store address and any collection reference." },
      { q: "Will I get proof of delivery?", a: "Yes. The driver uploads a photo when the item is delivered." },
    ],
  },
  {
    slug: "office-removals", name: "Office Removals", image: "office_moves",
    intro: "Move desks, chairs, IT equipment and archive boxes to a new office, a storage unit or between sites, with vehicles sized to the job.",
    moves: ["Desks, chairs and meeting tables", "IT equipment and screens", "Filing cabinets and archive boxes", "Small office and studio moves", "Moves between sites", "Office clear-outs"],
    vehicles: ["Long Wheelbase Van", "Luton Van", "Luton Van with Tail Lift", "7.5 Tonne Lorry"],
    related: ["house-removals", "business-and-retail-deliveries", "document-courier"],
    faqs: [
      { q: "Can you move us out of hours?", a: "Yes. Choose the date and time that suits you, including evenings and weekends, when you post the job." },
      { q: "How do I list everything?", a: "Add the main items, the number of boxes and the floors at each end. Photos help drivers judge the vehicle and help needed." },
      { q: "Is there a lift or loading bay?", a: "Say so in the job, along with any building rules or booking times for lifts and loading bays." },
      { q: "Do you pack IT equipment?", a: "Packing isn't included as standard. Back up data, pack and label equipment before the driver arrives." },
      { q: "Can I use a business account?", a: "See our business page for more on using Cargo One for your company." },
    ],
  },
  {
    slug: "student-moves", name: "Student Moves", image: "house_moves",
    intro: "Move into or out of halls or a shared house, take your things home for the summer or move into storage, with a driver and van sized to your stuff.",
    moves: ["Moves into and out of halls", "Shared house moves", "Boxes, suitcases and bags", "Desks, chairs and small furniture", "Moves home at the end of term", "Storage unit runs"],
    vehicles: ["Small Van", "Short Wheelbase Van", "Long Wheelbase Van", "Luton Van"],
    related: ["man-and-van", "house-removals", "single-item-delivery"],
    faqs: [
      { q: "Can friends share one move?", a: "Yes. Add every pickup and drop-off and list everyone's items so the driver knows what to expect." },
      { q: "How big a van do I need?", a: "A few boxes and bags fit a small van. A room's worth of furniture usually needs a long wheelbase or Luton van." },
      { q: "Can you collect from halls?", a: "Yes. Add the block name, any loading area and any move-out times the halls have given you." },
      { q: "Can I book at short notice?", a: "Yes. Choose ASAP for a same-day move, or book ahead for busy weeks at the start and end of term." },
      { q: "Do I need to be there?", a: "Someone should be at pickup and drop-off. You can add a friend's contact details if you can't be there." },
    ],
  },
  {
    slug: "long-distance-removals", name: "Long Distance Removals", image: "long_distance_uk",
    intro: "Move home across the UK, from England to Scotland or Wales or the length of the country, with one driver taking your belongings door to door.",
    moves: ["Full house moves across the UK", "Flat moves to another city", "Part-loads and single rooms", "Moves into storage near your new home", "Furniture and white goods", "Boxed belongings"],
    vehicles: ["Long Wheelbase Van", "Luton Van", "Luton Van with Tail Lift", "7.5 Tonne Lorry", "18 Tonne Lorry"],
    related: ["house-removals", "man-and-van", "furniture-delivery"],
    faqs: [
      { q: "Does the same driver do the whole journey?", a: "Yes. The driver who collects your belongings delivers them, with no depot in between." },
      { q: "How far ahead should I book?", a: "Book as soon as you know your moving date to get the most choice of drivers." },
      { q: "Can the move take two days?", a: "Very long moves may need two days. Agree timings with your driver in the app before the day." },
      { q: "Can I compare prices?", a: "Post it as a Bid Job and drivers send their own prices, or set your own price with a Fixed Price Job." },
      { q: "Should I pack before the driver arrives?", a: "Yes. Have everything boxed and labelled, with fragile items clearly marked." },
    ],
  },
  {
    slug: "shipping-container-transport", name: "Shipping Container Transport", image: "shipping_containers",
    intro: "Move a storage or shipping container to a farm, site, yard or business, on a vehicle with a crane or the right equipment for unloading.",
    moves: ["10, 20 and 40 foot containers", "Storage containers", "Site offices and welfare units", "Containers bought privately", "Moves between yards and sites", "Empty container deliveries"],
    vehicles: ["Shipping Container Capable", "Hiab Crane Vehicle", "Flatbed Truck", "Curtain Side Vehicle"],
    related: ["freight-and-haulage", "machinery-haulage", "building-materials-delivery"],
    faqs: [
      { q: "How is the container unloaded?", a: "Usually by crane on the vehicle. Say whether there's a crane or forklift on site, or if the driver needs to bring one." },
      { q: "What access is needed?", a: "Firm, level ground, room to manoeuvre and no overhead cables where it's placed. Add photos of the spot if you can." },
      { q: "Can you move a loaded container?", a: "Tell us what's inside and the total weight so drivers with a suitable vehicle can take the job." },
      { q: "What sizes can you move?", a: "Add the container's length and weight. Drivers see this before they accept." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "agricultural-machinery-transport", name: "Agricultural Machinery Transport", image: "agricultural",
    intro: "Move tractors, quad bikes, trailers and farm equipment between farms, dealers, workshops and shows, on flatbeds, lowloaders or crane lorries.",
    moves: ["Compact and vintage tractors", "Farm trailers and implements", "Quad bikes and utility vehicles", "Mowers and grounds equipment", "Machinery bought at auction", "Non-running farm machinery"],
    vehicles: ["Flatbed Truck", "Hiab Crane Vehicle", "Heavy Recovery / Lowloader", "7.5 Tonne Lorry", "18 Tonne Lorry"],
    related: ["machinery-haulage", "horsebox-and-trailer-transport", "freight-and-haulage"],
    faqs: [
      { q: "What details do you need?", a: "The make and model, weight, dimensions, and whether it can be driven on or needs lifting or winching." },
      { q: "Can you collect from a field or yard?", a: "Add access notes, including ground conditions and gate widths, so the driver can bring a suitable vehicle." },
      { q: "Can you collect from a farm auction?", a: "Yes. Add the lot number and any collection reference." },
      { q: "Can you move very large machinery?", a: "For abnormal loads that need permits or escorts, contact us first so we can check what's possible." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "building-materials-delivery", name: "Building Materials Delivery", image: "building_materials",
    intro: "Get timber, plasterboard, bricks, tiles and other materials collected from a merchant or yard and delivered to your site or home.",
    moves: ["Timber and sheet materials", "Plasterboard and insulation", "Bricks, blocks and paving", "Tiles, sanitaryware and kitchens", "Bagged aggregates on pallets", "Tools and site equipment"],
    vehicles: ["Long Wheelbase Van", "Luton Van with Tail Lift", "Flatbed Truck", "Hiab Crane Vehicle", "7.5 Tonne Lorry"],
    related: ["pallet-delivery", "shipping-container-transport", "machinery-haulage"],
    faqs: [
      { q: "Can you collect from a builders' merchant?", a: "Yes. Add the merchant's address and your order reference." },
      { q: "Can the driver offload with a crane?", a: "Choose a crane vehicle or say you need one in the job. Add where materials should be placed." },
      { q: "Can you deliver to a building site?", a: "Yes. Add site rules, delivery times and a site contact." },
      { q: "How do I describe the load?", a: "List the materials, quantities and rough weights, and whether they're on pallets." },
      { q: "Will I get proof of delivery?", a: "Yes. The driver uploads photos when the materials are delivered." },
    ],
  },
  {
    slug: "event-equipment-transport", name: "Event Equipment Transport", image: "event_equipment",
    intro: "Move staging, sound and lighting kit, exhibition stands and market stalls to venues and back, booked for the times you need.",
    moves: ["Exhibition stands and displays", "Sound and lighting equipment", "Staging and marquees", "Market stall and pop-up kit", "Furniture for events", "Return trips after the event"],
    vehicles: ["Long Wheelbase Van", "Luton Van", "Luton Van with Tail Lift", "7.5 Tonne Lorry"],
    related: ["business-and-retail-deliveries", "freight-and-haulage", "same-day-courier"],
    faqs: [
      { q: "Can I book a return trip?", a: "Yes. Post the delivery and the collection as separate jobs, each with its own time." },
      { q: "Can you deliver to a venue loading dock?", a: "Yes. Add the venue's delivery instructions and booking times." },
      { q: "What if timings are tight?", a: "Add the latest arrival time in the job so drivers can check it suits them before they accept." },
      { q: "Do drivers help set up?", a: "Set-up isn't included as standard. Say if you need help unloading." },
      { q: "Can I track the delivery?", a: "Yes. You can follow your driver live on the map." },
    ],
  },
  {
    slug: "document-courier", name: "Document Courier", image: "documents",
    intro: "Send contracts, legal papers, keys and other important documents straight to the recipient with a dedicated driver.",
    moves: ["Contracts and legal documents", "Signed originals", "Keys and access cards", "Tender and bid documents", "Medical and professional records", "Small items for businesses"],
    vehicles: ["Motorcycle Courier", "Small Van"],
    related: ["same-day-courier", "parcel-delivery", "business-and-retail-deliveries"],
    faqs: [
      { q: "Is it delivered directly?", a: "Yes. The driver who collects your documents delivers them, with no sorting centre in between." },
      { q: "Can I send it today?", a: "Yes. Choose ASAP and your job goes to nearby drivers who are online." },
      { q: "Can I get proof of delivery?", a: "Yes. The driver uploads a photo, and the recipient's signature where available." },
      { q: "How should I pack documents?", a: "Use a sealed envelope or document wallet, clearly addressed to the recipient." },
      { q: "Can I name who should receive it?", a: "Yes. Add the recipient's name and phone number to the job." },
    ],
  },
  {
    slug: "fragile-and-high-value-delivery", name: "Fragile and High-Value Delivery", image: "fragile_high_value",
    intro: "Move artwork, antiques, mirrors, glass and other delicate items with a driver who knows the item needs extra care.",
    moves: ["Artwork and framed prints", "Antiques and collectables", "Mirrors and glass", "Musical instruments", "Electronics and AV equipment", "Ceramics and sculpture"],
    vehicles: ["Small Van", "Short Wheelbase Van", "Long Wheelbase Van", "Luton Van"],
    related: ["furniture-delivery", "single-item-delivery", "parcel-delivery"],
    faqs: [
      { q: "How do drivers know it's fragile?", a: "Mark the job as fragile and describe the item. Drivers see this before they accept." },
      { q: "Should I pack the item?", a: "Yes. Wrap and protect it well before the driver arrives, and say if you need blankets or straps." },
      { q: "Can I check the item on delivery?", a: "Yes. The driver uploads photos at delivery, and you can check the item with them before they leave." },
      { q: "What if the item is very valuable?", a: "Check whether you need your own insurance for its value before you book." },
      { q: "Can I track it?", a: "Yes. You can follow your driver live on the map." },
    ],
  },
  {
    slug: "garden-and-outdoor-items", name: "Garden and Outdoor Items", image: "garden_outdoor",
    intro: "Move garden furniture, sheds, hot tubs, ride-on mowers and plant pots between homes, stores and sellers.",
    moves: ["Garden furniture and BBQs", "Flat-pack sheds and greenhouses", "Hot tubs", "Ride-on mowers", "Large plant pots and planters", "Play equipment and trampolines"],
    vehicles: ["Long Wheelbase Van", "Luton Van", "Luton Van with Tail Lift", "Flatbed Truck"],
    related: ["single-item-delivery", "marketplace-collection", "man-and-van"],
    faqs: [
      { q: "Can you move a hot tub?", a: "Yes. Add its size and weight, and access at both ends, including gates and steps." },
      { q: "Can you collect from a garden centre?", a: "Yes. Add the store address and any order reference." },
      { q: "Do you take items through the house?", a: "Say whether items need to go through the house or round the side, and add gate widths." },
      { q: "Can I book for today?", a: "Yes. Choose ASAP and your job goes to nearby drivers who are online." },
      { q: "Will I get proof of delivery?", a: "Yes. The driver uploads photos when the job is done." },
    ],
  },
  {
    slug: "freight-and-haulage", name: "Freight and Haulage", image: "freight",
    intro: "Book lorries and HGVs for full loads, part loads and bulk goods across the UK, with vehicles matched to the weight and size.",
    moves: ["Full and part loads", "Palletised goods", "Bulk stock for warehouses", "Long-distance haulage", "Return loads", "Loads needing tail lifts or cranes"],
    vehicles: ["7.5 Tonne Lorry", "18 Tonne Lorry", "Curtain Side Vehicle", "Articulated HGV", "Hiab Crane Vehicle", "Refrigerated Vehicle"],
    related: ["pallet-delivery", "machinery-haulage", "business-and-retail-deliveries"],
    faqs: [
      { q: "What details do you need?", a: "What's being moved, total weight, number of pallets or dimensions, and loading facilities at each end." },
      { q: "Can I compare prices?", a: "Post it as a Bid Job and drivers send their own prices, or set your own price with a Fixed Price Job." },
      { q: "Do you have refrigerated vehicles?", a: "Choose a refrigerated vehicle when you book, and drivers with one can take the job." },
      { q: "Is there a forklift needed?", a: "Say whether there's a forklift or loading bay at each end, or choose a vehicle with a tail lift." },
      VEHICLE_FAQ_TRACK,
    ],
  },
  {
    slug: "business-and-retail-deliveries", name: "Business and Retail Deliveries", image: "retail_business",
    intro: "Move stock, orders and equipment for your business, from shop restocks and customer deliveries to runs between sites.",
    moves: ["Shop restocks and stock transfers", "Customer orders and deliveries", "Shop fittings and displays", "Trade and wholesale orders", "Returns and collections", "Runs between sites"],
    vehicles: ["Small Van", "Long Wheelbase Van", "Luton Van with Tail Lift", "7.5 Tonne Lorry"],
    related: ["same-day-courier", "pallet-delivery", "freight-and-haulage"],
    faqs: [
      { q: "Can I book regular runs?", a: "Yes. You can post jobs as often as you need." },
      { q: "Can my customers track the delivery?", a: "You can follow the driver live and get photo proof of delivery to share." },
      { q: "Can I book a delivery for today?", a: "Yes. Choose ASAP and your job goes to nearby drivers who are online." },
      { q: "Do you offer business accounts?", a: "See our business page for more on using Cargo One for your company." },
      { q: "Can you collect from a warehouse?", a: "Yes. Add the warehouse address, loading times and any reference." },
    ],
  },
];

export const EXTRA_SERVICE_BY_SLUG = Object.fromEntries(EXTRA_SERVICE_PAGES.map((s) => [s.slug, s]));
export const ALL_SERVICE_PAGES = [...SERVICE_PAGES, ...EXTRA_SERVICE_PAGES];
export const ALL_SERVICE_BY_SLUG = Object.fromEntries(ALL_SERVICE_PAGES.map((s) => [s.slug, s]));

// Phase 3 pages keep titles ≤60 and meta descriptions ≤155 by falling back to shorter variants.
const fit = (max, ...options) => options.find((o) => o.length <= max) || options[options.length - 1];

export function extraServiceSeo(service) {
  const seo = serviceSeo(service);
  const first = service.intro.split(". ")[0].replace(/\.$/, "");
  return {
    ...seo,
    title: fit(60, seo.title, `${service.name} | Cargo One`),
    description: fit(155, seo.description, `${first}. Instant quote and live tracking.`, `${first}.`),
  };
}
// Batch 2 services that also get service×place pages (Wave 1 cities + Phase 3 places).
const LOCAL_EXTRA_SERVICES = ["non-runner-car-transport", "van-transport"];

// ---------- SEO Phase 3: extra local places (own hubs, service×place and driver pages) ----------
const B1_SERVICES = ["man-and-van", "house-removals", "furniture-delivery", "same-day-courier", "car-transport", "vehicle-recovery", "marketplace-collection", ...LOCAL_EXTRA_SERVICES];
const B3_SERVICES = ["man-and-van", "house-removals", "car-transport", "vehicle-recovery", "same-day-courier"];

// ---------- SEO Phase 4: remaining UK cities and big towns (appended to LOCAL_PLACES below) ----------
const P4_SERVICES = ["man-and-van", "house-removals", "furniture-delivery", "same-day-courier", "car-transport", "vehicle-recovery", "marketplace-collection"];
const p4 = (slug, name, kind, region, d) => ({
  slug, name, kind, region, services: P4_SERVICES, cleanAir: null, ...d,
  localFaq: {
    q: `Do you cover ${d.nearbyTowns.towns[0]} and ${d.nearbyTowns.towns[1]}?`,
    a: `Yes. Customers can post jobs from ${list(d.nearbyTowns.towns.slice(0, 4))} and other towns around ${name}, and approved drivers nearby with suitable vehicles can send quotes.`,
  },
  driver: d.noDriverPage ? null : {
    note: `${name} jobs run along the ${list(d.roads.slice(0, 3))}, with work around ${list(d.industrial.slice(0, 2))}.`,
    faq: { q: `Are there jobs around ${d.industrial[0]}?`, a: `Customers post all kinds of jobs, which can include collections and deliveries around ${list(d.industrial.slice(0, 2))}. Read the job details and access notes before you bid.` },
  },
});

// Batch 1: North West
const P4_NORTH_WEST = [
  p4("preston", "Preston", "city", "Lancashire", {
    residential: ["Fulwood", "Ashton-on-Ribble", "Penwortham", "Ribbleton", "Ingol", "Walton-le-Dale"],
    retail: ["the St George's Shopping Centre", "Fishergate", "Deepdale Shopping Park", "the Fishergate Centre"],
    business: ["Preston city centre", "Preston Docks", "Lancashire Business Park", "the area around Preston station"],
    industrial: ["Red Scar", "Preston Docks", "Walton Summit", "Roman Way"],
    roads: ["M6", "M55", "M61", "A59"],
    parking: "Fishergate and the city centre have bus lanes and pedestrian areas, while suburbs like Fulwood and Penwortham usually have driveways or side streets for loading.",
    character: "Preston is Lancashire's main city, where the M6, M55 and M61 meet.",
    nearby: [["blackpool", "M55"], ["lancaster", "M6"], ["blackburn", "M65"], ["bolton", "M61"], ["wigan", "M6"], ["manchester", "M61"]],
    nearbyTowns: { text: "Preston sits at the centre of a ring of Lancashire market towns, from Garstang in the north to Chorley and Leyland in the south.", towns: ["Chorley", "Leyland", "Longridge", "Garstang", "Kirkham", "Accrington"] },
  }),
  p4("blackburn", "Blackburn", "town", "Lancashire", {
    residential: ["Darwen", "Wilpshire", "Mellor", "Feniscowles", "Lammack", "Livesey"],
    retail: ["The Mall Blackburn", "Blackburn Market", "Peel Centre", "King William Street"],
    business: ["Blackburn town centre", "Blackburn Cathedral Quarter", "Shadsworth Business Park", "Walker Park"],
    industrial: ["Shadsworth", "Whitebirk", "Walker Park", "Greenbank"],
    roads: ["M65", "A666", "A677", "M6 junction 31"],
    parking: "Blackburn's town centre has a ring road and short-stay parking, and terraced streets in older areas can be narrow, so check where a vehicle can stop.",
    character: "Blackburn is a Lancashire mill town on the M65, between Preston and Burnley.",
    nearby: [["preston", "M65"], ["burnley", "M65"], ["bolton", "A666"]],
    nearbyTowns: { text: "Blackburn is surrounded by former mill towns along the M65 and the Ribble Valley to the north.", towns: ["Darwen", "Accrington", "Clitheroe", "Oswaldtwistle", "Great Harwood"] },
  }),
  p4("burnley", "Burnley", "town", "Lancashire", {
    residential: ["Padiham", "Brierfield", "Rosegrove", "Burnley Wood", "Harle Syke", "Worsthorne"],
    retail: ["the Charter Walk Shopping Centre", "Burnley Market", "Centenary Way Retail Park", "St James's Street"],
    business: ["Burnley town centre", "Burnley Bridge Business Park", "the Weavers' Triangle", "Shuttleworth Mead"],
    industrial: ["Shuttleworth Mead", "Heasandford", "Burnley Bridge Business Park", "Network 65"],
    roads: ["M65", "A646", "A671", "A56"],
    parking: "Burnley has steep terraced streets in areas like Burnley Wood, so add access notes for hills, narrow streets and parking.",
    character: "Burnley is an East Lancashire town at the eastern end of the M65, close to the Pennine hills.",
    nearby: [["blackburn", "M65"], ["preston", "M65"], ["manchester", "A56 and M66"]],
    nearbyTowns: { text: "Burnley is the largest of a group of Pennine towns along the M65 and the Rossendale Valley.", towns: ["Nelson", "Colne", "Padiham", "Accrington", "Rawtenstall"] },
  }),
  p4("bolton", "Bolton", "town", "Greater Manchester", {
    residential: ["Horwich", "Westhoughton", "Farnworth", "Heaton", "Astley Bridge", "Bromley Cross"],
    retail: ["Crompton Place", "Market Place Shopping Centre", "Middlebrook Retail Park", "Bolton Market"],
    business: ["Bolton town centre", "Middlebrook", "Lostock", "Logistics North"],
    industrial: ["Logistics North", "Lostock", "Middlebrook", "Wingates Industrial Estate"],
    roads: ["M61", "M60", "A666", "A58"],
    parking: "Bolton town centre has pedestrian streets and a busy one-way system, while Horwich and Westhoughton are usually easier for loading.",
    character: "Bolton is a large Greater Manchester town on the M61, with big distribution sites at Logistics North and Middlebrook.",
    nearby: [["manchester", "A666 or M61"], ["wigan", "A58 or M61"], ["blackburn", "A666"], ["preston", "M61"]],
    nearbyTowns: { text: "Bolton is close to several Greater Manchester and Lancashire towns, many linked by the M61 and A666.", towns: ["Bury", "Chorley", "Leigh", "Atherton", "Darwen", "Ramsbottom"] },
  }),
  p4("wigan", "Wigan", "town", "Greater Manchester", {
    residential: ["Standish", "Orrell", "Pemberton", "Hindley", "Ashton-in-Makerfield", "Aspull"],
    retail: ["the Grand Arcade", "the Galleries", "Robin Park", "Wigan Market"],
    business: ["Wigan town centre", "Wigan Pier", "Robin Park", "Martland Park"],
    industrial: ["Martland Park", "Westwood Park", "Kirkless", "Bryn"],
    roads: ["M6", "M58", "M61", "A49"],
    parking: "Wigan town centre has pedestrian areas around the Grand Arcade, while estates in Standish and Orrell usually have room to load.",
    character: "Wigan is a Greater Manchester town on the M6, between Liverpool, Manchester and Preston.",
    nearby: [["bolton", "A58 or M61"], ["warrington", "M6"], ["preston", "M6"], ["liverpool", "M58 or A580"], ["manchester", "M61"]],
    nearbyTowns: { text: "Wigan sits between Merseyside and Greater Manchester, with smaller towns spread along the M6 and M58.", towns: ["Leigh", "Skelmersdale", "Ormskirk", "St Helens", "Chorley", "Atherton"] },
  }),
  p4("blackpool", "Blackpool", "town", "Lancashire", {
    residential: ["Bispham", "South Shore", "Layton", "Marton", "Thornton-Cleveleys", "Lytham St Annes"],
    retail: ["the Houndshill Shopping Centre", "Church Street", "Clifton Retail Park", "Cleveleys town centre"],
    business: ["Blackpool town centre", "Blackpool Airport Enterprise Zone", "Squires Gate", "Whitehills Business Park"],
    industrial: ["Squires Gate", "Whitehills Business Park", "Clifton Road", "Vicarage Lane"],
    roads: ["M55", "A583", "A584", "A585"],
    parking: "The promenade and town centre get very busy in summer and during the Illuminations, so allow extra time and check parking near seafront properties.",
    character: "Blackpool is a seaside resort on the Fylde coast, linked to the M6 by the M55.",
    nearby: [["preston", "M55"], ["lancaster", "M55 and M6"]],
    nearbyTowns: { text: "Blackpool is the largest town on the Fylde coast, with smaller towns along the seafront and inland.", towns: ["Lytham St Annes", "Fleetwood", "Poulton-le-Fylde", "Kirkham", "Thornton-Cleveleys"] },
  }),
  p4("warrington", "Warrington", "town", "Cheshire", {
    residential: ["Great Sankey", "Penketh", "Stockton Heath", "Birchwood", "Padgate", "Lymm"],
    retail: ["Golden Square", "Gemini Retail Park", "Cockhedge Shopping Park", "Stockton Heath village"],
    business: ["Warrington town centre", "Birchwood Park", "Omega", "Centre Park"],
    industrial: ["Omega", "Birchwood", "Winwick Quay", "Woolston Grange"],
    roads: ["M6", "M62", "M56", "A49"],
    parking: "Warrington's swing bridges over the Ship Canal can cause delays, and the town centre has bus lanes, so plan timings and add parking notes.",
    character: "Warrington is a large Cheshire town where the M6, M62 and M56 meet, with big logistics sites at Omega.",
    nearby: [["liverpool", "M62"], ["manchester", "M62 or A57"], ["wigan", "M6"], ["chester", "M56"], ["stockport", "M56 and M60"]],
    nearbyTowns: { text: "Warrington is ringed by smaller Cheshire and Merseyside towns, most within a short drive on the M6, M56 and M62.", towns: ["Widnes", "Runcorn", "Leigh", "Newton-le-Willows", "Northwich", "Knutsford"] },
  }),
  p4("stockport", "Stockport", "town", "Greater Manchester", {
    residential: ["Heaton Moor", "Bramhall", "Cheadle", "Marple", "Hazel Grove", "Edgeley"],
    retail: ["Merseyway", "Redrock", "Stockport Market", "Peel Centre"],
    business: ["Stockport town centre", "Stockport Exchange", "Cheadle Royal Business Park", "Adswood"],
    industrial: ["Adswood", "Bredbury", "Hazel Grove", "Reddish"],
    roads: ["M60", "A6", "A34", "M56"],
    parking: "Stockport town centre is hilly, with pedestrian areas around Merseyway, and the A6 can be slow at peak times.",
    character: "Stockport is a Greater Manchester town on the M60, south of Manchester city centre.",
    nearby: [["manchester", "A6 or M60"], ["oldham", "M60"], ["warrington", "M60 and M56"]],
    nearbyTowns: { text: "Stockport borders Cheshire and the edge of the Peak District, with smaller towns to the south and east.", towns: ["Hyde", "Wilmslow", "Macclesfield", "Glossop", "Poynton", "Denton"] },
  }),
  p4("oldham", "Oldham", "town", "Greater Manchester", {
    residential: ["Chadderton", "Royton", "Shaw", "Failsworth", "Lees", "Saddleworth"],
    retail: ["the Spindles Town Square Shopping Centre", "Elk Mill Retail Park", "Oldham town centre", "Alexandra Retail Park"],
    business: ["Oldham town centre", "Hollinwood", "Broadway Business Park", "Chadderton"],
    industrial: ["Hollinwood", "Broadway", "Higginshaw", "Greenacres"],
    roads: ["M60", "M62", "A62", "A627(M)"],
    parking: "Oldham sits on high ground with steep streets, and terraced areas can be narrow, so check where the driver can stop.",
    character: "Oldham is a Greater Manchester town on the edge of the Pennines, close to the M60 and M62.",
    nearby: [["manchester", "A62"], ["stockport", "M60"]],
    nearbyTowns: { text: "Oldham sits between Manchester and the Pennines, with smaller towns spread along the M60 and M62.", towns: ["Rochdale", "Ashton-under-Lyne", "Middleton", "Stalybridge", "Heywood"] },
  }),
  p4("lancaster", "Lancaster", "city", "Lancashire", {
    residential: ["Bowerham", "Scotforth", "Skerton", "Morecambe", "Heysham", "Halton"],
    retail: ["the St Nicholas Arcades", "Marketgate", "Penny Street", "Morecambe town centre"],
    business: ["Lancaster city centre", "Lancaster University", "White Cross", "Lancaster Business Park"],
    industrial: ["White Lund", "Heysham Port", "Lancaster Business Park", "Lansil"],
    roads: ["M6", "A6", "A683", "A589"],
    parking: "Lancaster's city centre has a one-way system and narrow streets near the castle, so loading is often easier from side streets.",
    character: "Lancaster is a small historic city on the M6 in north Lancashire, close to Morecambe Bay.",
    nearby: [["preston", "M6"], ["blackpool", "M6 and M55"]],
    nearbyTowns: { text: "Lancaster is the hub for north Lancashire and the edge of the Lake District and Yorkshire Dales.", towns: ["Morecambe", "Carnforth", "Heysham", "Garstang", "Kirkby Lonsdale"] },
  }),
  p4("chester", "Chester", "city", "Cheshire", {
    residential: ["Hoole", "Upton", "Handbridge", "Blacon", "Boughton", "Saltney"],
    retail: ["the Grosvenor Shopping Centre", "the Rows", "Cheshire Oaks Designer Outlet", "Greyhound Retail Park"],
    business: ["Chester city centre", "Chester Business Park", "Sealand", "Broughton"],
    industrial: ["Sealand Road", "Deeside Industrial Park", "Broughton", "Ellesmere Port"],
    roads: ["A55", "M53", "M56", "A483"],
    parking: "Chester's walled city centre has pedestrian streets and limited vehicle access, so plan loading outside the walls where possible.",
    character: "Chester is a walled Roman city in Cheshire, close to the Welsh border and the A55.",
    nearby: [["warrington", "M56"], ["liverpool", "M53"], ["manchester", "M56"]],
    nearbyTowns: { text: "Chester sits on the border with North Wales, with towns in Cheshire, Flintshire and the Wirral close by.", towns: ["Ellesmere Port", "Mold", "Northwich", "Frodsham", "Deeside", "Wrexham"] },
  }),
];

// Batch 2: Yorkshire and North East
const P4_YORKSHIRE_NE = [
  p4("york", "York", "city", "North Yorkshire", {
    residential: ["Acomb", "Heworth", "Clifton", "Fulford", "Dringhouses", "Haxby"],
    retail: ["Coppergate", "Monks Cross", "Vangarde Shopping Park", "Clifton Moor"],
    business: ["York city centre", "York Business Park", "the area around York station", "Clifton Moor"],
    industrial: ["Clifton Moor", "Monks Cross", "Osbaldwick", "Murton"],
    roads: ["A64", "A1237 outer ring road", "A19", "A59"],
    parking: "York's walled centre has narrow streets, footstreets with timed vehicle access and limited loading, so plan where the driver can stop.",
    character: "York is a historic walled city in North Yorkshire, ringed by the A64 and A1237.",
    nearby: [["leeds", "A64"], ["doncaster", "A19"], ["middlesbrough", "A19"]],
    nearbyTowns: { text: "York is the hub for a wide area of North Yorkshire, from spa towns to market towns on the edge of the moors.", towns: ["Harrogate", "Selby", "Malton", "Tadcaster", "Pocklington", "Easingwold"] },
  }),
  p4("huddersfield", "Huddersfield", "town", "West Yorkshire", {
    residential: ["Lindley", "Almondbury", "Marsh", "Birkby", "Fartown", "Honley"],
    retail: ["the Kingsgate Centre", "the Packhorse Centre", "Great Northern Retail Park", "Huddersfield Market"],
    business: ["Huddersfield town centre", "Lindley Moor", "the University of Huddersfield campus", "Leeds Road"],
    industrial: ["Leeds Road", "Lindley Moor", "Bradley", "Brighouse"],
    roads: ["M62", "A62", "A629", "A640"],
    parking: "Huddersfield is hilly, the town centre is ringed by a busy ring road, and terraced streets in older areas can be narrow.",
    character: "Huddersfield is a West Yorkshire town in the Colne Valley, just south of the M62.",
    nearby: [["leeds", "M62"], ["manchester", "M62"], ["wakefield", "A642"], ["oldham", "A62"], ["sheffield", "A616 and M1"]],
    nearbyTowns: { text: "Huddersfield is surrounded by Pennine valley towns and villages, many on the A62 and A629.", towns: ["Holmfirth", "Brighouse", "Dewsbury", "Halifax", "Marsden", "Batley"] },
  }),
  p4("wakefield", "Wakefield", "city", "West Yorkshire", {
    residential: ["Sandal", "Outwood", "Horbury", "Ossett", "Stanley", "Crigglestone"],
    retail: ["Trinity Walk", "the Ridings Centre", "Westgate Retail Park", "Wakefield city centre"],
    business: ["Wakefield city centre", "Wakefield Europort", "Calder Park", "Wakefield 41"],
    industrial: ["Wakefield Europort", "Wakefield 41", "Calder Park", "Normanton"],
    roads: ["M1", "M62", "A638", "A61"],
    parking: "Wakefield city centre has a busy ring road and one-way streets, while suburbs like Sandal and Outwood usually have driveways.",
    character: "Wakefield is a West Yorkshire city where the M1 and M62 meet, with large distribution parks nearby.",
    nearby: [["leeds", "M1"], ["huddersfield", "A642"], ["doncaster", "A638"], ["sheffield", "M1"]],
    nearbyTowns: { text: "Wakefield is close to a ring of former mining and market towns around the M1, M62 and A1(M).", towns: ["Pontefract", "Castleford", "Ossett", "Normanton", "Featherstone", "Dewsbury"] },
  }),
  p4("doncaster", "Doncaster", "city", "South Yorkshire", {
    residential: ["Bessacarr", "Balby", "Bentley", "Armthorpe", "Sprotbrough", "Cantley"],
    retail: ["Frenchgate", "Lakeside Village", "the Doncaster Market", "Wheatley Hall Road"],
    business: ["Doncaster city centre", "Lakeside", "iPort", "Doncaster Sheffield Airport business park"],
    industrial: ["iPort", "Carcroft", "Wheatley Hall Road", "Balby Carr"],
    roads: ["A1(M)", "M18", "M180", "A630"],
    parking: "Doncaster city centre has pedestrian streets around Frenchgate and a busy inner ring road, while suburbs like Bessacarr are usually easier.",
    character: "Doncaster is a South Yorkshire city close to the A1(M), M18 and M180, with big logistics sites at iPort.",
    nearby: [["sheffield", "M18 or A630"], ["wakefield", "A638"], ["york", "A19"]],
    nearbyTowns: { text: "Doncaster is surrounded by South Yorkshire and North Lincolnshire towns, many off the A1(M) and M18.", towns: ["Rotherham", "Thorne", "Mexborough", "Askern", "Barnsley", "Gainsborough"] },
  }),
  p4("sunderland", "Sunderland", "city", "Tyne and Wear", {
    residential: ["Roker", "Seaburn", "Washington", "Hendon", "Barnes", "Silksworth"],
    retail: ["The Bridges", "Doxford Park", "Washington Galleries", "Sunderland Retail Park"],
    business: ["Sunderland city centre", "Doxford International Business Park", "the Port of Sunderland", "Rainton Bridge"],
    industrial: ["the International Advanced Manufacturing Park", "Pallion", "Hylton Riverside", "the Port of Sunderland"],
    roads: ["A19", "A1(M)", "A1231", "A690"],
    parking: "Sunderland city centre has pedestrian streets around The Bridges, and seafront roads at Roker and Seaburn get busy in summer.",
    character: "Sunderland is a coastal city on the River Wear, with car and advanced manufacturing along the A19.",
    nearby: [["newcastle", "A19 or A1(M)"], ["durham", "A690"], ["middlesbrough", "A19"]],
    nearbyTowns: { text: "Sunderland sits between Tyneside and County Durham, with coastal and former mining towns close by.", towns: ["Washington", "Houghton-le-Spring", "Seaham", "South Shields", "Chester-le-Street"] },
  }),
  p4("middlesbrough", "Middlesbrough", "town", "North Yorkshire", {
    residential: ["Linthorpe", "Acklam", "Marton", "Nunthorpe", "Coulby Newham", "Ormesby"],
    retail: ["the Cleveland Centre", "the Hill Street Centre", "Teesside Park", "Linthorpe Road"],
    business: ["Middlesbrough town centre", "Teesside Park", "Middlehaven", "Riverside Park"],
    industrial: ["Riverside Park", "Teesport", "South Bank", "Teesside Industrial Estate"],
    roads: ["A19", "A66", "A174", "A172"],
    parking: "Middlesbrough town centre has bus lanes and pedestrian streets, while suburbs like Acklam and Nunthorpe usually have driveways.",
    character: "Middlesbrough is the largest town on Teesside, between the River Tees and the North York Moors.",
    nearby: [["sunderland", "A19"], ["durham", "A177"], ["york", "A19"]],
    nearbyTowns: { text: "Middlesbrough is the centre of Teesside, with towns along the river and the coast close by.", towns: ["Stockton-on-Tees", "Redcar", "Thornaby", "Guisborough", "Billingham", "Hartlepool"] },
  }),
  p4("durham", "Durham", "city", "County Durham", {
    residential: ["Gilesgate", "Framwellgate Moor", "Belmont", "Neville's Cross", "Bowburn", "Brandon"],
    retail: ["Prince Bishops Shopping Centre", "the Riverwalk", "Arnison Retail Centre", "the Market Place"],
    business: ["Durham city centre", "Mount Oswald", "Durham University", "Belmont Business Park"],
    industrial: ["Belmont Industrial Estate", "Dragonville", "Meadowfield", "Bowburn"],
    roads: ["A1(M)", "A690", "A167", "A177"],
    parking: "Durham's historic centre is hilly with narrow cobbled streets, and the peninsula around the cathedral has very limited vehicle access.",
    character: "Durham is a small cathedral and university city in the North East, just off the A1(M).",
    nearby: [["newcastle", "A167 or A1(M)"], ["sunderland", "A690"], ["middlesbrough", "A177"]],
    nearbyTowns: { text: "Durham is surrounded by County Durham market and former mining towns, many close to the A1(M).", towns: ["Chester-le-Street", "Spennymoor", "Bishop Auckland", "Consett", "Newton Aycliffe", "Peterlee"] },
  }),
];

// Batch 3: East and East Midlands
const P4_EAST = [
  p4("northampton", "Northampton", "town", "Northamptonshire", {
    residential: ["Duston", "Weston Favell", "Kingsthorpe", "Abington", "Wootton", "Moulton"],
    retail: ["the Grosvenor Centre", "Weston Favell Shopping Centre", "Sixfields", "Riverside Retail Park"],
    business: ["Northampton town centre", "Brackmills", "Moulton Park", "Grange Park"],
    industrial: ["Brackmills", "Moulton Park", "Swan Valley", "Round Spinney"],
    roads: ["M1 junctions 15 and 16", "A45", "A43", "A508"],
    parking: "Northampton town centre has pedestrian areas around the Market Square and a busy inner ring road, while estates in Duston and Wootton usually have room to load.",
    character: "Northampton is a large Midlands town on the M1, with big distribution parks at Brackmills and Swan Valley.",
    nearby: [["luton", "M1"], ["coventry", "A45 and M45"], ["peterborough", "A45 and A14"], ["birmingham", "M1 and M6"]],
    nearbyTowns: { text: "Northampton is surrounded by Northamptonshire market towns, many on the A43, A45 and A14.", towns: ["Wellingborough", "Daventry", "Towcester", "Rushden", "Kettering", "Brackley"] },
  }),
  p4("peterborough", "Peterborough", "city", "Cambridgeshire", {
    residential: ["Orton", "Werrington", "Bretton", "Hampton", "Stanground", "Paston"],
    retail: ["Queensgate", "Serpentine Green", "Brotherhood Retail Park", "Cathedral Square"],
    business: ["Peterborough city centre", "Lynch Wood", "Fengate", "Hampton"],
    industrial: ["Fengate", "Eastern Industry", "Orton Southgate", "Kingston Park"],
    roads: ["A1(M)", "A47", "A15", "A605"],
    parking: "Peterborough's parkways make it quick to get around, though the city centre around Queensgate has pedestrian streets and limited loading.",
    character: "Peterborough is a Cambridgeshire cathedral city on the A1(M), with large warehouses along the parkways.",
    nearby: [["cambridge", "A14 and A1(M)"], ["lincoln", "A15"], ["northampton", "A605 and A45"], ["norwich", "A47"]],
    nearbyTowns: { text: "Peterborough is the hub for the western Fens and the market towns off the A1(M) and A47.", towns: ["Stamford", "Whittlesey", "Oundle", "Market Deeping", "Huntingdon", "Spalding"] },
  }),
  p4("cambridge", "Cambridge", "city", "Cambridgeshire", {
    residential: ["Chesterton", "Cherry Hinton", "Trumpington", "Arbury", "Romsey", "Histon"],
    retail: ["the Grand Arcade", "the Grafton", "Beehive Centre", "Cambridge Retail Park"],
    business: ["Cambridge city centre", "Cambridge Science Park", "the Cambridge Biomedical Campus", "Cambridge Business Park"],
    industrial: ["Cambridge Business Park", "Cowley Road", "Milton", "Bar Hill"],
    roads: ["M11", "A14", "A10", "A428"],
    parking: "Central Cambridge has narrow streets, bus gates and many cycle routes, with limited vehicle access around the colleges.",
    character: "Cambridge is a university city in the east of England, between the M11 and the A14.",
    nearby: [["peterborough", "A14 and A1(M)"], ["norwich", "A11"], ["ipswich", "A14"], ["chelmsford", "M11 and A120"], ["london", "M11"]],
    nearbyTowns: { text: "Cambridge is surrounded by villages and market towns along the A14, A10 and M11.", towns: ["Ely", "St Ives", "Newmarket", "Royston", "Saffron Walden", "Huntingdon"] },
  }),
  p4("norwich", "Norwich", "city", "Norfolk", {
    residential: ["Eaton", "Thorpe St Andrew", "Hellesdon", "Costessey", "Sprowston", "Old Catton"],
    retail: ["Chapelfield", "Castle Quarter", "Longwater Retail Park", "Riverside"],
    business: ["Norwich city centre", "Broadland Business Park", "the Norwich Research Park", "Thorpe"],
    industrial: ["Hellesdon", "Sweet Briar", "Broadland Business Park", "Longwater"],
    roads: ["A11", "A47", "A140", "A1270 Broadland Northway"],
    parking: "Norwich's medieval centre has narrow lanes, a one-way inner ring road and limited loading, so plan where the driver can stop.",
    character: "Norwich is Norfolk's main city, linked to Cambridge by the A11 and ringed by the A47 southern bypass.",
    nearby: [["ipswich", "A140"], ["cambridge", "A11"], ["peterborough", "A47"]],
    nearbyTowns: { text: "Norwich serves a wide area of Norfolk and north Suffolk, from the Broads to the coast.", towns: ["Wymondham", "Dereham", "Great Yarmouth", "Lowestoft", "Aylsham", "Diss"] },
  }),
  p4("ipswich", "Ipswich", "town", "Suffolk", {
    residential: ["Kesgrave", "Rushmere", "Whitton", "Chantry", "Pinewood", "Felixstowe"],
    retail: ["the Buttermarket", "Sailmakers", "Anglia Retail Park", "Martlesham Heath"],
    business: ["Ipswich town centre", "Ipswich Waterfront", "Adastral Park", "Ransomes Europark"],
    industrial: ["Ransomes Europark", "the Port of Felixstowe", "Sproughton", "Hadleigh Road"],
    roads: ["A14", "A12", "A1214", "A140"],
    parking: "Ipswich town centre has a one-way system and pedestrian streets, and port traffic on the A14 towards Felixstowe can be heavy.",
    character: "Ipswich is Suffolk's county town on the River Orwell, on the A14 route to the Port of Felixstowe.",
    nearby: [["norwich", "A140"], ["cambridge", "A14"], ["chelmsford", "A12"]],
    nearbyTowns: { text: "Ipswich is the hub for east Suffolk, with port and coastal towns close by.", towns: ["Felixstowe", "Woodbridge", "Stowmarket", "Needham Market", "Hadleigh", "Colchester"] },
  }),
  p4("luton", "Luton", "town", "Bedfordshire", {
    residential: ["Stopsley", "Wigmore", "Leagrave", "Bushmead", "Dunstable", "Barton-le-Clay"],
    retail: ["The Mall Luton", "the Galaxy Centre", "Gipsy Lane", "Dunstable town centre"],
    business: ["Luton town centre", "London Luton Airport", "Capability Green", "Butterfield"],
    industrial: ["Butterfield", "Sundon Park", "Chaul End", "Woodside Industrial Estate"],
    roads: ["M1 junctions 10 and 11", "A505", "A6", "A1081"],
    parking: "Luton town centre has a busy inner ring road and bus lanes, and roads near the airport can be congested at peak times.",
    character: "Luton is a large Bedfordshire town on the M1, home to London Luton Airport.",
    nearby: [["london", "M1"], ["northampton", "M1"], ["cambridge", "A505 and A10"]],
    nearbyTowns: { text: "Luton sits on the M1 between Bedfordshire and Hertfordshire, with several towns close by.", towns: ["Dunstable", "Harpenden", "Leighton Buzzard", "Houghton Regis", "Hitchin", "St Albans"] },
  }),
  p4("lincoln", "Lincoln", "city", "Lincolnshire", {
    residential: ["Birchwood", "Ermine", "Boultham", "Bracebridge Heath", "North Hykeham", "Nettleham"],
    retail: ["the Waterside Shopping Centre", "Cornhill Quarter", "Tritton Road", "St Mark's Shopping Centre"],
    business: ["Lincoln city centre", "the Brayford Waterfront", "Lincoln Science and Innovation Park", "Teal Park"],
    industrial: ["Teal Park", "Sadler Road", "Allenby Road", "Outer Circle Road"],
    roads: ["A46", "A15", "A57", "A158"],
    parking: "Steep Hill and the cathedral quarter are very steep and narrow, so loading uphill can be difficult; the lower city is easier.",
    character: "Lincoln is a historic cathedral city in Lincolnshire, on the A46 between Nottingham and the Humber.",
    nearby: [["nottingham", "A46"], ["peterborough", "A15"], ["sheffield", "A57"]],
    nearbyTowns: { text: "Lincoln is the hub for central Lincolnshire, with market towns spread across a wide rural area.", towns: ["Gainsborough", "Sleaford", "Market Rasen", "Newark", "Saxilby", "Woodhall Spa"] },
  }),
  p4("chelmsford", "Chelmsford", "city", "Essex", {
    residential: ["Springfield", "Great Baddow", "Writtle", "Broomfield", "Chelmer Village", "Beaulieu Park"],
    retail: ["Bond Street", "the Meadows", "the High Chelmer Shopping Centre", "Chelmsford Retail Park"],
    business: ["Chelmsford city centre", "Chelmsford Business Park", "Springfield", "Widford"],
    industrial: ["Widford Industrial Estate", "Springfield Business Park", "Waterhouse Lane", "Boreham"],
    roads: ["A12", "A130", "A414", "A1060"],
    parking: "Chelmsford city centre has pedestrian streets and a busy ring road, while estates in Springfield and Great Baddow usually have room to load.",
    character: "Chelmsford is the county city of Essex, on the A12 between London and Colchester.",
    nearby: [["london", "A12"], ["ipswich", "A12"], ["cambridge", "A120 and M11"]],
    nearbyTowns: { text: "Chelmsford is at the centre of Essex, with commuter and market towns close by on the A12 and A130.", towns: ["Braintree", "Maldon", "Witham", "Brentwood", "Billericay", "Basildon"] },
  }),
];

// Batch 4: South
const P4_SOUTH = [
  p4("bournemouth", "Bournemouth", "town", "Dorset", {
    residential: ["Boscombe", "Southbourne", "Winton", "Kinson", "Westbourne", "Poole"],
    retail: ["Castlepoint", "the Square", "the Dolphin Centre in Poole", "Westbourne"],
    business: ["Bournemouth town centre", "Lansdowne", "Bournemouth Airport business park", "Poole Quay"],
    industrial: ["Ferndown Industrial Estate", "Nuffield Industrial Estate", "Bournemouth Airport business park", "Kinson"],
    roads: ["A338 Wessex Way", "A35", "A31", "A348"],
    parking: "Seafront and town-centre roads get very busy in summer, and many flats along the cliff top have limited parking, so add access notes.",
    character: "Bournemouth is a seaside town on the Dorset coast, joined to Poole and Christchurch and linked to the M27 by the A31 and A338.",
    nearby: [["basingstoke", "A31, M27 and M3"], ["bath", "A338 and A36"]],
    nearbyTowns: { text: "Bournemouth is part of a continuous coastal area with Poole and Christchurch, with Dorset and New Forest towns close by.", towns: ["Christchurch", "Ringwood", "Wimborne", "Ferndown", "Wareham", "Verwood"] },
  }),
  p4("exeter", "Exeter", "city", "Devon", {
    residential: ["Heavitree", "St Thomas", "Pennsylvania", "Alphington", "Pinhoe", "Topsham"],
    retail: ["Princesshay", "the Guildhall Shopping Centre", "Marsh Barton", "Exeter Retail Park"],
    business: ["Exeter city centre", "Exeter Science Park", "Sowton", "Matford"],
    industrial: ["Marsh Barton", "Sowton", "Matford", "Exeter Airport business park"],
    roads: ["M5", "A30", "A38", "A379"],
    parking: "Exeter's city centre has pedestrian streets around Princesshay, and Marsh Barton and the M5 junctions get busy at peak times.",
    character: "Exeter is Devon's county city, where the M5 ends and the A30 and A38 head west.",
    nearby: [["bristol", "M5"], ["bath", "M5 and A4"]],
    nearbyTowns: { text: "Exeter is the hub for East and Mid Devon, with coastal and market towns close by.", towns: ["Exmouth", "Crediton", "Tiverton", "Honiton", "Newton Abbot", "Dawlish"] },
  }),
  p4("swindon", "Swindon", "town", "Wiltshire", {
    residential: ["Old Town", "Wroughton", "Stratton", "Haydon Wick", "Covingham", "Wichelstowe"],
    retail: ["the Brunel Centre", "Swindon Designer Outlet", "Greenbridge Retail Park", "Orbital Shopping Park"],
    business: ["Swindon town centre", "Windmill Hill Business Park", "Groundwell", "the area around Swindon station"],
    industrial: ["South Marston", "Kembrey Park", "Groundwell", "Dorcan"],
    roads: ["M4 junctions 15 and 16", "A419", "A420", "A4361"],
    parking: "Swindon's Magic Roundabout and busy town-centre junctions can slow jobs, while estates in Wroughton and Haydon Wick usually have room to load.",
    character: "Swindon is a large Wiltshire town on the M4, between Bristol and Reading.",
    nearby: [["bath", "M4"], ["bristol", "M4"], ["gloucester", "A419 and A417"], ["cheltenham", "A419 and A417"], ["basingstoke", "M4 and A339"]],
    nearbyTowns: { text: "Swindon is close to Wiltshire and Cotswold market towns along the M4 and A419.", towns: ["Highworth", "Royal Wootton Bassett", "Marlborough", "Cirencester", "Chippenham", "Faringdon"] },
  }),
  p4("gloucester", "Gloucester", "city", "Gloucestershire", {
    residential: ["Quedgeley", "Abbeydale", "Longlevens", "Hucclecote", "Kingsway", "Tuffley"],
    retail: ["Gloucester Quays", "the Eastgate Shopping Centre", "St Oswald's Retail Park", "Northgate Street"],
    business: ["Gloucester city centre", "Gloucester Docks", "Waterwells Business Park", "Barnwood"],
    industrial: ["Waterwells", "Hempsted", "Kingsway", "Barnwood"],
    roads: ["M5", "A40", "A38", "A417"],
    parking: "Gloucester city centre has pedestrian streets around the Cross, and the docks and Quays can be busy at weekends.",
    character: "Gloucester is a cathedral city on the River Severn, close to the M5 and the edge of the Cotswolds.",
    nearby: [["cheltenham", "A40"], ["bristol", "M5"], ["worcester", "M5"], ["swindon", "A417 and A419"]],
    nearbyTowns: { text: "Gloucester serves the Severn Vale and Forest of Dean as well as the Cotswold edge.", towns: ["Stroud", "Tewkesbury", "Newent", "Cinderford", "Ledbury", "Dursley"] },
  }),
  p4("cheltenham", "Cheltenham", "town", "Gloucestershire", {
    residential: ["Charlton Kings", "Leckhampton", "Prestbury", "Up Hatherley", "Benhall", "Bishop's Cleeve"],
    retail: ["the Regent Arcade", "the Promenade", "Kingsditch Retail Park", "the Brewery Quarter"],
    business: ["Cheltenham town centre", "Cheltenham Office Park", "Kingsditch", "Arle Court"],
    industrial: ["Kingsditch", "Swindon Village", "Bishop's Cleeve", "Lansdown Industrial Estate"],
    roads: ["M5", "A40", "A435", "A46"],
    parking: "Cheltenham's Regency streets have controlled parking, and race weeks bring heavy traffic around Prestbury and the racecourse.",
    character: "Cheltenham is a Regency spa town in Gloucestershire, on the edge of the Cotswolds near the M5.",
    nearby: [["gloucester", "A40"], ["worcester", "M5"], ["swindon", "A417 and A419"], ["birmingham", "M5"]],
    nearbyTowns: { text: "Cheltenham is close to Cotswold and Severn Vale towns, many within a short drive on the A40 and M5.", towns: ["Tewkesbury", "Winchcombe", "Bishop's Cleeve", "Stow-on-the-Wold", "Cirencester", "Northleach"] },
  }),
  p4("bath", "Bath", "city", "Somerset", {
    residential: ["Widcombe", "Larkhall", "Weston", "Combe Down", "Oldfield Park", "Bathwick"],
    retail: ["SouthGate", "Milsom Street", "the Podium", "Pines Way"],
    business: ["Bath city centre", "Bath Quays", "Lower Bristol Road", "the University of Bath"],
    industrial: ["Lower Bristol Road", "Brassmill Lane", "Locksbrook Road", "Westpoint Trading Estate"],
    roads: ["A4", "A36", "A46", "M4 junction 18"],
    parking: "Bath's centre has steep hills, narrow Georgian streets and controlled parking, so add access notes and loading details.",
    cleanAir: { text: "Bath has a Clean Air Zone in the city centre. Check whether your vehicle is affected.", url: GOV_CAZ, label: "GOV.UK Clean Air Zone checker" },
    character: "Bath is a Georgian spa city in Somerset, linked to the M4 by the A46.",
    nearby: [["bristol", "A4"], ["swindon", "M4"], ["exeter", "M5 and A4"]],
    nearbyTowns: { text: "Bath is surrounded by Somerset and Wiltshire market towns and villages.", towns: ["Keynsham", "Bradford-on-Avon", "Midsomer Norton", "Radstock", "Trowbridge", "Corsham"] },
  }),
  p4("basingstoke", "Basingstoke", "town", "Hampshire", {
    residential: ["Brighton Hill", "Chineham", "Hatch Warren", "Kempshott", "Lychpit", "Popley"],
    retail: ["Festival Place", "Basing View", "Brighton Hill Retail Park", "the Top of Town"],
    business: ["Basingstoke town centre", "Basing View", "Chineham Business Park", "Viables"],
    industrial: ["Daneshill", "Viables", "Houndmills", "Kingsland"],
    roads: ["M3 junctions 6 and 7", "A33", "A339", "A303"],
    parking: "Basingstoke's ring road and roundabouts make access easy, though Festival Place and the town centre have limited loading.",
    character: "Basingstoke is a large Hampshire town on the M3, between London and Southampton.",
    nearby: [["london", "M3"], ["swindon", "A339 and M4"], ["bournemouth", "M3 and M27"]],
    nearbyTowns: { text: "Basingstoke is close to north Hampshire and Berkshire towns along the M3 and A33.", towns: ["Andover", "Alton", "Hook", "Tadley", "Fleet", "Newbury"] },
  }),
  p4("crawley", "Crawley", "town", "West Sussex", {
    residential: ["Three Bridges", "Pound Hill", "Southgate", "Broadfield", "Maidenbower", "Ifield"],
    retail: ["County Mall", "Queensway", "the Crawley Retail Park", "Crawley town centre"],
    business: ["Crawley town centre", "Manor Royal", "Gatwick Airport", "County Oak"],
    industrial: ["Manor Royal", "County Oak", "Gatwick cargo area", "Lowfield Heath"],
    roads: ["M23", "A23", "A264", "A2011"],
    parking: "Roads around Gatwick are busy at all hours, and Manor Royal has many loading bays, while new estates in Maidenbower and Pound Hill usually have room to load.",
    character: "Crawley is a West Sussex new town on the M23, next to Gatwick Airport.",
    nearby: [["london", "M23 and A23"], ["maidstone", "M23, M25 and M20"]],
    nearbyTowns: { text: "Crawley is close to Sussex and Surrey towns along the M23, A23 and A264.", towns: ["Horsham", "East Grinstead", "Redhill", "Reigate", "Haywards Heath", "Burgess Hill"] },
  }),
  p4("maidstone", "Maidstone", "town", "Kent", {
    residential: ["Allington", "Bearsted", "Shepway", "Tovil", "Barming", "Aylesford"],
    retail: ["Fremlin Walk", "the Mall Maidstone", "Aylesford Retail Park", "Week Street"],
    business: ["Maidstone town centre", "Kent Science Park", "Eclipse Park", "Lordswood"],
    industrial: ["Aylesford", "Parkwood", "Lordswood", "Larkfield"],
    roads: ["M20 junctions 5 to 8", "M2", "A229", "A20"],
    parking: "Maidstone town centre has a one-way gyratory and pedestrian streets, and the A229 can be slow at peak times.",
    character: "Maidstone is Kent's county town on the River Medway, between the M20 and the M2.",
    nearby: [["london", "M20"], ["crawley", "M20, M25 and M23"]],
    nearbyTowns: { text: "Maidstone sits in the middle of Kent, close to the Medway towns and the Weald.", towns: ["Rochester", "Chatham", "Tonbridge", "Sittingbourne", "West Malling", "Ashford"] },
  }),
  p4("worcester", "Worcester", "city", "Worcestershire", {
    residential: ["St John's", "Warndon", "Claines", "Ronkswood", "St Peter's", "Battenhall"],
    retail: ["Crowngate", "Cathedral Square", "Elgar Retail Park", "the High Street"],
    business: ["Worcester city centre", "Worcester Six Business Park", "Blackpole", "Shire Business Park"],
    industrial: ["Blackpole", "Worcester Six Business Park", "Sherriff Street", "Shrub Hill"],
    roads: ["M5 junctions 6 and 7", "A44", "A38", "A449"],
    parking: "Worcester's centre has pedestrian streets around the High Street, and the river bridges can be slow at peak times.",
    character: "Worcester is a cathedral city on the River Severn, just off the M5 between Birmingham and Gloucester.",
    nearby: [["birmingham", "M5"], ["cheltenham", "M5"], ["gloucester", "M5"], ["wolverhampton", "A449"]],
    nearbyTowns: { text: "Worcester serves a wide part of Worcestershire, from the Malverns to the Vale of Evesham.", towns: ["Droitwich Spa", "Malvern", "Evesham", "Pershore", "Kidderminster", "Bromsgrove"] },
  }),
];

// Batch 5: Scotland, Wales and Northern Ireland (Belfast already has a driver page, so hub and services only)
const P4_NATIONS = [
  p4("dundee", "Dundee", "city", "Tayside", {
    residential: ["Broughty Ferry", "Lochee", "Menzieshill", "Stobswell", "Downfield", "Monifieth"],
    retail: ["the Overgate", "the Wellgate Centre", "Kingsway West Retail Park", "Gallagher Retail Park"],
    business: ["Dundee city centre", "the Waterfront", "Technology Park", "Dundee University"],
    industrial: ["Dryburgh", "Baldovie", "the Port of Dundee", "Kingsway East"],
    roads: ["A90 Kingsway", "A92", "A85", "A972"],
    parking: "Dundee city centre has pedestrian streets around the Overgate and limited loading near the Waterfront, while Broughty Ferry has narrow streets near the seafront.",
    cleanAir: { text: "Dundee has a Low Emission Zone in the city centre. Check whether your vehicle is affected.", url: "https://www.lowemissionzones.scot/", label: "Low Emission Zones Scotland" },
    character: "Dundee is a Scottish city on the Firth of Tay, with the A90 Kingsway running round its north side.",
    nearby: [["perth", "A90"], ["stirling", "A90 and M9"], ["glasgow", "A90 and M80"]],
    nearbyTowns: { text: "Dundee serves Angus and north Fife as well as the city itself.", towns: ["Monifieth", "Arbroath", "Forfar", "Carnoustie", "Kirriemuir", "Tayport"] },
  }),
  p4("inverness", "Inverness", "city", "the Highlands", {
    residential: ["Culloden", "Smithton", "Hilton", "Crown", "Westhill", "Balloch"],
    retail: ["the Eastgate Shopping Centre", "Inverness Retail and Business Park", "the Victorian Market", "Telford Retail Park"],
    business: ["Inverness city centre", "Inverness Campus", "Beechwood", "Longman"],
    industrial: ["Longman", "Inverness Airport business park", "Harbour Road", "Carse"],
    roads: ["A9", "A96", "A82", "A862"],
    parking: "Inverness city centre has pedestrian streets around the Eastgate, and the A9 and A96 can be busy in summer with holiday traffic.",
    character: "Inverness is the main city of the Highlands, where the A9, A96 and A82 meet at the mouth of the River Ness.",
    nearby: [["perth", "A9"], ["dundee", "A9 and A90"]],
    nearbyTowns: { text: "Inverness is the hub for a wide part of the Highlands, with towns spread along the Moray Firth and Great Glen.", towns: ["Nairn", "Dingwall", "Beauly", "Aviemore", "Fort Augustus", "Tain"] },
  }),
  p4("stirling", "Stirling", "city", "Central Scotland", {
    residential: ["Bridge of Allan", "Bannockburn", "St Ninians", "Raploch", "Causewayhead", "Dunblane"],
    retail: ["the Thistles Shopping Centre", "Springkerse Retail Park", "Port Street", "Forthside"],
    business: ["Stirling city centre", "Stirling University Innovation Park", "Forthside", "Castle Business Park"],
    industrial: ["Springkerse", "Broadleys", "Kerse Road", "Bandeath"],
    roads: ["M9", "M80", "A84", "A91"],
    parking: "The old town below Stirling Castle is steep and cobbled with limited vehicle access, while newer areas are easier for loading.",
    character: "Stirling is a historic city in central Scotland, where the M9 and M80 meet below the castle.",
    nearby: [["glasgow", "M80"], ["perth", "M9 and A9"], ["dundee", "M9 and A90"]],
    nearbyTowns: { text: "Stirling sits between the Forth Valley and the edge of the Highlands, with towns along the M9 and A84.", towns: ["Dunblane", "Falkirk", "Alloa", "Callander", "Bridge of Allan", "Denny"] },
  }),
  p4("perth", "Perth", "city", "Perth and Kinross", {
    residential: ["Scone", "Letham", "Craigie", "Tulloch", "North Muirton", "Bridgend"],
    retail: ["St John's Shopping Centre", "the High Street", "St Catherine's Retail Park", "Broxden"],
    business: ["Perth city centre", "Broxden Business Park", "Inveralmond", "Ruthvenfield"],
    industrial: ["Inveralmond", "Shore Road", "Broxden", "Friarton"],
    roads: ["A9", "M90", "A90", "A85"],
    parking: "Perth city centre has pedestrian streets around the High Street, while roundabouts at Broxden and Inveralmond can be busy at peak times.",
    character: "Perth is a Scottish city on the River Tay, where the A9, M90 and A90 meet.",
    nearby: [["dundee", "A90"], ["stirling", "A9 and M9"], ["inverness", "A9"], ["glasgow", "A9 and M80"]],
    nearbyTowns: { text: "Perth is the gateway to Highland Perthshire and serves towns across Perth and Kinross.", towns: ["Crieff", "Blairgowrie", "Kinross", "Auchterarder", "Pitlochry", "Dunkeld"] },
  }),
  p4("newport", "Newport", "city", "South Wales", {
    residential: ["Malpas", "Caerleon", "Bettws", "Rogerstone", "Duffryn", "St Julians"],
    retail: ["Friars Walk", "Newport Retail Park", "Commercial Street", "Newport Market"],
    business: ["Newport city centre", "Celtic Springs Business Park", "Imperial Park", "Langstone"],
    industrial: ["Newport Docks", "Queensway Meadows", "Llanwern", "Imperial Park"],
    roads: ["M4 junctions 24 to 28", "A48", "A4042", "A467"],
    parking: "The M4 Brynglas tunnels are a known bottleneck, and Newport city centre has pedestrian streets around Friars Walk.",
    character: "Newport is a South Wales city on the River Usk and the M4, between Cardiff and the Severn crossings.",
    nearby: [["bristol", "M4"], ["gloucester", "A48"]],
    nearbyTowns: { text: "Newport is close to Cardiff and the valleys and border towns of south-east Wales.", towns: ["Cwmbran", "Caerphilly", "Chepstow", "Pontypool", "Cardiff", "Abergavenny"] },
  }),
  p4("wrexham", "Wrexham", "city", "North Wales", {
    residential: ["Gresford", "Rhosddu", "Acton", "Borras", "Rhos", "Ruabon"],
    retail: ["Eagles Meadow", "Island Green", "Henblas Square", "Wrexham Central Retail Park"],
    business: ["Wrexham city centre", "Wrexham Industrial Estate", "Wrexham Technology Park", "Llay"],
    industrial: ["Wrexham Industrial Estate", "Llay", "Ash Road", "Bersham"],
    roads: ["A483", "A541", "A525", "A534"],
    parking: "Wrexham city centre has pedestrian streets and limited loading, and match days near the Racecourse Ground bring extra traffic.",
    character: "Wrexham is North Wales's newest city, on the A483 close to Chester and the English border.",
    nearby: [["chester", "A483"], ["liverpool", "A483 and M53"], ["manchester", "A483 and M56"]],
    nearbyTowns: { text: "Wrexham serves north-east Wales and the border, with towns close by in Wales and Cheshire.", towns: ["Mold", "Llangollen", "Ruabon", "Gresford", "Chirk", "Chester"] },
  }),
  p4("belfast", "Belfast", "city", "Northern Ireland", {
    noDriverPage: true,
    residential: ["Ballyhackamore", "Stranmillis", "Ormeau", "Andersonstown", "Holywood", "Newtownabbey"],
    retail: ["Victoria Square", "CastleCourt", "the Boucher Road retail parks", "Forestside"],
    business: ["Belfast city centre", "the Titanic Quarter", "the Gasworks", "Sydenham"],
    industrial: ["Belfast Harbour", "Duncrue", "Boucher Road", "Mallusk"],
    roads: ["M1", "M2", "A12 Westlink", "M3"],
    parking: "Belfast city centre has bus lanes and pedestrian streets around Donegall Place, and the Westlink can be slow at peak times.",
    character: "Belfast is the capital of Northern Ireland, at the head of Belfast Lough, where the M1, M2 and M3 meet.",
    nearby: [["glasgow", "Belfast to Cairnryan ferry and A77"], ["liverpool", "Belfast to Birkenhead ferry"]],
    nearbyTowns: { text: "Belfast serves the towns around Belfast Lough and along the M1 and M2.", towns: ["Lisburn", "Bangor", "Newtownards", "Carrickfergus", "Antrim", "Comber"] },
  }),
];

export const LOCAL_PLACES = [
  {
    slug: "stafford", name: "Stafford", kind: "town", region: "Staffordshire", services: B1_SERVICES,
    residential: ["Baswich", "Wildwood", "Rising Brook", "Highfields", "Weeping Cross", "Stone"],
    retail: ["the Guildhall Shopping Centre", "Riverside", "Greengate Street", "Queensville Retail Park"],
    business: ["Stafford town centre", "Beacon Business Park", "the area around Stafford station", "Redhill Business Park"],
    industrial: ["Astonfields", "Redhill Business Park", "Hixon Industrial Estate", "the area around the County Showground"],
    roads: ["M6 junctions 13 and 14", "A34", "A449", "A518"],
    parking: "Much of Stafford town centre around Greengate Street is pedestrianised, so loading is easier from the surrounding streets, while suburbs like Baswich and Wildwood usually have driveways.",
    cleanAir: null,
    character: "Stafford is Staffordshire's county town, sitting on the M6 between Birmingham and Stoke-on-Trent.",
    nearby: [["stoke-on-trent", "A34 or M6"], ["cannock", "A34"], ["wolverhampton", "A449"], ["telford", "A518"], ["lichfield", "A513 and A51"], ["birmingham", "M6"]],
    localFaq: { q: "Can I book a move from Stafford to Stone or the villages nearby?", a: "Yes. Enter the pickup and drop-off anywhere in and around Stafford, including Stone and villages off the A34 and A51, and you'll see your price." },
    driver: { note: "Stafford sits between M6 junctions 13 and 14, with the A34 running north to Stoke and south to Cannock.", faq: { q: "Is Stafford a good base for M6 work?", a: "Stafford has two M6 junctions, so jobs north to Stoke-on-Trent and south to Birmingham are within easy reach. You choose which jobs to bid on or accept." } },
  },
  {
    slug: "stoke-on-trent", name: "Stoke-on-Trent", kind: "city", region: "Staffordshire", services: B1_SERVICES,
    residential: ["Trentham", "Penkhull", "Hartshill", "Meir", "Blurton", "Newcastle-under-Lyme"],
    retail: ["the Potteries Centre in Hanley", "Festival Park", "Trentham Shopping Village", "Hanley's Cultural Quarter"],
    business: ["Hanley city centre", "the Etruria Valley", "the area around Stoke station", "Trentham Lakes"],
    industrial: ["Trentham Lakes", "the Etruria Valley", "Sideway", "Longton"],
    roads: ["A500", "M6 junctions 15 and 16", "A50", "A53"],
    parking: "Stoke is six towns joined by the A500, and terraced streets in places like Burslem and Longton can be narrow, so check where a vehicle can stop.",
    cleanAir: null,
    character: "Stoke-on-Trent grew from six pottery towns, Tunstall, Burslem, Hanley, Stoke, Fenton and Longton, all linked by the A500.",
    nearby: [["stafford", "A34 or M6"], ["derby", "A50"], ["burton-upon-trent", "A50 and A38"], ["birmingham", "M6"]],
    localFaq: { q: "Do you cover all six towns in Stoke-on-Trent?", a: "Yes. Drivers cover Tunstall, Burslem, Hanley, Stoke, Fenton and Longton, plus Newcastle-under-Lyme and the villages around them." },
    driver: null,
  },
  {
    slug: "wolverhampton", name: "Wolverhampton", kind: "city", region: "the West Midlands", services: B1_SERVICES,
    residential: ["Tettenhall", "Penn", "Finchfield", "Wednesfield", "Bilston", "Codsall"],
    retail: ["the Mander Centre", "the Wulfrun Centre", "Bentley Bridge Retail Park", "Wolverhampton Market"],
    business: ["Wolverhampton city centre", "Wolverhampton Science Park", "the Interchange by the station", "Wolverhampton Business Park"],
    industrial: ["i54 South Staffordshire", "Wobaston Road", "Bilston", "Willenhall Road"],
    roads: ["M6", "M54", "A449", "A4123 Birmingham New Road"],
    parking: "The Ring Road loops tightly around the city centre, with pedestrian streets and bus lanes inside it, while Tettenhall and Penn are usually easier for loading.",
    cleanAir: null,
    character: "Wolverhampton sits where the Black Country meets Staffordshire, close to the M6 and the M54.",
    nearby: [["birmingham", "A4123 or M6"], ["walsall", "A454"], ["telford", "M54"], ["cannock", "A460"], ["stafford", "A449"]],
    localFaq: { q: "Do you cover the Black Country towns around Wolverhampton?", a: "Yes. Drivers cover Wolverhampton and nearby Black Country towns like Bilston, Wednesfield and Willenhall, as well as Codsall and Tettenhall." },
    driver: { note: "Wolverhampton jobs run between the Black Country, the M6 and the M54 towards Telford.", faq: { q: "Is there industrial work around i54?", a: "Customers post all kinds of jobs, which can include collections and deliveries around i54 and the industrial estates off the M54. Check new Bid Jobs and Fixed Price Jobs for work that fits your vehicle." } },
  },
  {
    slug: "telford", name: "Telford", kind: "town", region: "Shropshire", services: B1_SERVICES,
    residential: ["Wellington", "Madeley", "Dawley", "Priorslee", "Lawley", "Newport"],
    retail: ["Telford Centre", "Southwater", "Telford Forge Retail Park", "Wellington Market"],
    business: ["Telford town centre", "Hadley Park", "Hortonwood", "Stafford Park"],
    industrial: ["Stafford Park", "Hortonwood", "Halesfield", "Tweedale"],
    roads: ["M54", "A5", "A442 Queensway", "A518"],
    parking: "Telford's main roads are mostly dual carriageways and roundabouts, so access is usually easy, while the older streets of Ironbridge and Madeley are narrow and steep.",
    cleanAir: null,
    character: "Telford is a new town built around the Ironbridge Gorge, with large industrial estates along the M54.",
    nearby: [["wolverhampton", "M54"], ["stafford", "A518"], ["birmingham", "M54 and M6"]],
    localFaq: { q: "Can I book a delivery to or from Ironbridge?", a: "Yes. Add access notes for steep or narrow streets in Ironbridge and Coalbrookdale so drivers can bring a suitable vehicle." },
    driver: { note: "Telford work runs between its business parks and along the M54 to Wolverhampton and the M6.", faq: { q: "Are there jobs around Telford's industrial estates?", a: "Customers post all kinds of jobs, which can include work around Stafford Park, Halesfield and Hortonwood. Read the job details and access notes before you bid." } },
  },
  {
    slug: "cannock", name: "Cannock", kind: "town", region: "Staffordshire", services: B1_SERVICES,
    residential: ["Hednesford", "Heath Hayes", "Norton Canes", "Chadsmoor", "Huntington", "Pye Green"],
    retail: ["McArthurGlen Designer Outlet West Midlands", "Cannock town centre", "Orbital Retail Park", "Hednesford town centre"],
    business: ["Cannock town centre", "Kingswood Lakeside", "Watling Street Business Park", "Hednesford"],
    industrial: ["Kingswood Lakeside", "Bridgtown", "Norton Canes", "Watling Street Business Park"],
    roads: ["M6 Toll", "A5 Watling Street", "A460", "A34"],
    parking: "Cannock town centre has pedestrian areas and short-stay parking, while estates in Hednesford and Heath Hayes usually have room to load.",
    cleanAir: null,
    character: "Cannock sits on the A5 beside Cannock Chase, with the M6 Toll and the M6 close by.",
    nearby: [["stafford", "A34"], ["wolverhampton", "A460"], ["walsall", "A34"], ["lichfield", "A5190 or A5"], ["birmingham", "M6 Toll and M6"]],
    localFaq: { q: "Can I book a collection from the designer outlet near Cannock?", a: "Yes. Add the store name and any collection reference to your job, and a driver can collect and deliver to your home." },
    driver: { note: "Cannock is close to the M6 Toll, the A5 and the M6, with distribution sites around Kingswood Lakeside.", faq: { q: "Do I have to use the M6 Toll?", a: "No. You choose your route. If a job uses the M6 Toll, include the cost in your price." } },
  },
  {
    slug: "walsall", name: "Walsall", kind: "town", region: "the West Midlands", services: B1_SERVICES,
    residential: ["Aldridge", "Streetly", "Bloxwich", "Pelsall", "Willenhall", "Brownhills"],
    retail: ["the Saddlers Centre", "Crown Wharf Retail Park", "Walsall Market", "Park Street"],
    business: ["Walsall town centre", "Walsall Waterfront", "Aldridge", "Darlaston"],
    industrial: ["Darlaston", "Aldridge", "Willenhall", "Bloxwich"],
    roads: ["M6 junctions 9 and 10", "A34", "A454 Black Country Route", "A4148 Ring Road"],
    parking: "The town centre is ringed by the A4148, with pedestrian streets around Park Street, while Aldridge and Streetly are usually easier for loading.",
    cleanAir: null,
    character: "Walsall is a Black Country town just off M6 junctions 9 and 10, with a strong manufacturing history.",
    nearby: [["birmingham", "A34 or M6"], ["wolverhampton", "A454"], ["cannock", "A34"], ["lichfield", "A461"]],
    localFaq: { q: "Do you cover Aldridge, Bloxwich and Brownhills?", a: "Yes. Drivers cover all of Walsall, including Aldridge, Bloxwich, Brownhills, Pelsall and Willenhall." },
    driver: { note: "Walsall sits on the M6 between junctions 9 and 10, with Birmingham and Wolverhampton a short drive away.", faq: { q: "Can I take Birmingham jobs from Walsall?", a: "Yes. The A34 and the M6 link Walsall to Birmingham, and you choose which jobs to bid on or accept." } },
  },
  {
    slug: "coventry", name: "Coventry", kind: "city", region: "the West Midlands", services: B1_SERVICES,
    residential: ["Earlsdon", "Tile Hill", "Allesley", "Styvechale", "Wyken", "Kenilworth"],
    retail: ["West Orchards", "the Lower Precinct", "Coventry Market", "Gallagher Retail Park"],
    business: ["Coventry city centre", "Friargate", "Westwood Business Park", "the University of Warwick Science Park"],
    industrial: ["Ansty Park", "Ryton", "Whitley", "Prologis Park"],
    roads: ["A45", "A46", "M6", "M69"],
    parking: "Coventry's inner Ring Road has closely spaced junctions and much of the centre is pedestrianised, so plan where the driver can stop.",
    cleanAir: null,
    character: "Coventry is a West Midlands city ringed by the A45 and A46, with the M6 and M69 to the north.",
    nearby: [["birmingham", "A45 or M6"], ["lichfield", "M6 and A38"], ["walsall", "M6"], ["derby", "M69 and M1"]],
    localFaq: { q: "Do you cover Kenilworth and the area around the University of Warwick?", a: "Yes. Drivers cover all of Coventry plus nearby places like Kenilworth, the University of Warwick and the villages off the A45 and A46." },
    driver: null,
  },
  {
    slug: "derby", name: "Derby", kind: "city", region: "Derbyshire", services: B1_SERVICES,
    residential: ["Allestree", "Littleover", "Mickleover", "Darley Abbey", "Chaddesden", "Spondon"],
    retail: ["Derbion", "Kingsway Retail Park", "Pride Park", "the Cathedral Quarter"],
    business: ["Pride Park", "the Cathedral Quarter", "Derby city centre", "Infinity Park"],
    industrial: ["Sinfin", "Raynesway", "Infinity Park", "Ascot Drive"],
    roads: ["A38", "A52", "A50", "M1 junctions 24 and 25"],
    parking: "Derby's inner ring road and busy A38 junctions can slow city-centre jobs, while suburbs like Allestree and Littleover are usually easier to park in.",
    cleanAir: null,
    character: "Derby is an East Midlands city with a long engineering history, close to the A38, A50 and M1.",
    nearby: [["burton-upon-trent", "A38"], ["stoke-on-trent", "A50"], ["lichfield", "A38"], ["birmingham", "A38"]],
    localFaq: { q: "Do you cover Pride Park and the villages around Derby?", a: "Yes. Drivers cover all of Derby, including Pride Park and Derby city centre, and villages like Duffield and Borrowash." },
    driver: { note: "Derby jobs run along the A38, A50 and A52, with the M1 a few miles east.", faq: { q: "Can I take jobs between Derby and Nottingham?", a: "Yes. The A52 links Derby and Nottingham, and you choose which jobs to bid on or accept." } },
  },
  {
    slug: "lichfield", name: "Lichfield", kind: "city", region: "Staffordshire", services: B1_SERVICES,
    residential: ["Boley Park", "Darwin Park", "Curborough", "Streethay", "Whittington", "Shenstone"],
    retail: ["the Three Spires Shopping Centre", "the Market Square", "Bore Street", "Tamworth Street"],
    business: ["Lichfield city centre", "the area around Lichfield Trent Valley station", "Burntwood Business Park", "Fradley Park"],
    industrial: ["Fradley Park", "Burntwood Business Park", "Britannia Way", "Cappers Lane"],
    roads: ["A38", "A5", "A51", "M6 Toll"],
    parking: "Lichfield's centre has narrow historic streets near the cathedral and pedestrian areas around the Market Square, so plan where the driver can stop.",
    cleanAir: null,
    character: "Lichfield is a small cathedral city in Staffordshire, on the A38 between Birmingham and Burton upon Trent.",
    nearby: [["birmingham", "A38"], ["burton-upon-trent", "A38"], ["cannock", "A5190 or A5"], ["walsall", "A461"], ["stafford", "A51 and A513"], ["derby", "A38"]],
    localFaq: { q: "Do you cover Burntwood and Fradley?", a: "Yes. Drivers cover Lichfield city and nearby places like Burntwood, Fradley, Shenstone and Whittington." },
    driver: { note: "Lichfield sits on the A38 and close to the M6 Toll, with distribution sites around Fradley Park.", faq: { q: "Is there warehouse work around Fradley Park?", a: "Customers post pallet and freight jobs too, which can include sites around Fradley Park. Check new Bid Jobs and Fixed Price Jobs for work that fits your vehicle." } },
  },
  {
    slug: "burton-upon-trent", name: "Burton upon Trent", kind: "town", region: "Staffordshire", services: B1_SERVICES,
    residential: ["Stapenhill", "Winshill", "Branston", "Horninglow", "Stretton", "Tutbury"],
    retail: ["the Octagon Centre", "Coopers Square", "Burton Market Hall", "Station Street"],
    business: ["Burton town centre", "Centrum 100", "the area around Burton station", "Branston"],
    industrial: ["Centrum 100", "Branston", "Dove Valley Park", "Hawkins Lane"],
    roads: ["A38", "A50", "A511", "A5121"],
    parking: "Burton town centre has pedestrian streets and loading limits, while residential areas like Stapenhill and Winshill sit across the River Trent.",
    cleanAir: null,
    character: "Burton upon Trent is a brewing town on the River Trent, with the A38 and A50 close by.",
    nearby: [["derby", "A38"], ["lichfield", "A38"], ["stoke-on-trent", "A50"], ["birmingham", "A38"]],
    localFaq: { q: "Do you cover the villages around Burton?", a: "Yes. Drivers cover Burton upon Trent and nearby places like Tutbury, Branston, Stretton and Swadlincote." },
    driver: { note: "Burton jobs run along the A38 to Derby and Lichfield, and the A50 towards Stoke-on-Trent.", faq: { q: "Are there jobs around Centrum 100 and Dove Valley Park?", a: "Customers post all kinds of jobs, which can include distribution sites around Centrum 100 and Dove Valley Park. Read the job details before you bid." } },
  },
  // Batch 3: remaining big UK cities
  {
    slug: "leicester", name: "Leicester", kind: "city", region: "Leicestershire", services: B3_SERVICES,
    residential: ["Clarendon Park", "Knighton", "Evington", "Oadby", "Wigston", "Birstall"],
    retail: ["Highcross", "the Haymarket Shopping Centre", "Fosse Park", "St Martins"],
    business: ["Leicester city centre", "Grove Park", "Meridian Business Park", "Space Park Leicester"],
    industrial: ["Beaumont Leys", "Thurmaston", "Braunstone Frith", "Troon Way"],
    roads: ["M1 junctions 21 and 21a", "M69", "A6", "A46"],
    parking: "Leicester's Central Ring Road has bus lanes and busy junctions, and terraced streets in areas like Clarendon Park and Highfields can be narrow.",
    cleanAir: null,
    character: "Leicester is an East Midlands city on the M1 and M69, with Fosse Park and big business parks around junction 21.",
    nearby: [["nottingham", "A46 or M1"], ["coventry", "M69"], ["milton-keynes", "M1"], ["birmingham", "M69 and M6"]],
    localFaq: { q: "Do you cover Oadby, Wigston and Birstall?", a: "Yes. Drivers cover all of Leicester and nearby places like Oadby, Wigston, Birstall, Glenfield and Thurmaston." },
    driver: null,
  },
  {
    slug: "bradford", name: "Bradford", kind: "city", region: "West Yorkshire", services: B3_SERVICES,
    residential: ["Shipley", "Saltaire", "Heaton", "Thornton", "Idle", "Bingley"],
    retail: ["the Broadway shopping centre", "the Kirkgate Centre", "Forster Square Retail Park", "Bradford city centre"],
    business: ["Bradford city centre", "Little Germany", "Forster Square", "Euroway"],
    industrial: ["Euroway Trading Estate", "Low Moor", "Bowling Back Lane", "Dudley Hill"],
    roads: ["M606", "M62", "A650", "A6177 Outer Ring Road"],
    parking: "Bradford is built on steep hills, and terraced streets in areas like Heaton and Thornton can be narrow, so check where a vehicle can stop.",
    cleanAir: { text: "Bradford has a Clean Air Zone inside the Outer Ring Road and along parts of the Aire Valley. Check whether your vehicle is affected.", url: GOV_CAZ, label: "GOV.UK Clean Air Zone checker" },
    character: "Bradford is a West Yorkshire city linked to the M62 by the M606, with Saltaire and the Aire Valley to the north.",
    nearby: [["leeds", "A647 or A650"], ["manchester", "M62"], ["hull", "M62 and A63"], ["sheffield", "M62 and M1"]],
    localFaq: { q: "Do you cover Shipley, Saltaire and Bingley?", a: "Yes. Drivers cover all of Bradford, including Shipley, Saltaire, Bingley and Keighley." },
    driver: null,
  },
  {
    slug: "hull", name: "Hull", kind: "city", region: "East Yorkshire", services: B3_SERVICES,
    residential: ["Cottingham", "Hessle", "Anlaby", "Sutton-on-Hull", "Kirk Ella", "Willerby"],
    retail: ["Princes Quay", "St Stephen's", "Kingswood Retail Park", "Hull city centre"],
    business: ["Hull city centre", "the Fruit Market", "Hull Marina", "Hesslewood"],
    industrial: ["the Port of Hull", "Saltend", "Sutton Fields", "Hedon Road"],
    roads: ["A63", "M62", "A1033", "A15 Humber Bridge"],
    parking: "Hull's Old Town has narrow cobbled streets, and the A63 through the city centre can be busy, so plan timings and where to stop.",
    cleanAir: null,
    character: "Hull sits on the Humber Estuary at the end of the M62 and A63, with a busy port to the east of the city.",
    nearby: [["leeds", "A63 and M62"], ["bradford", "A63 and M62"], ["sheffield", "M62 and M18"]],
    localFaq: { q: "Can I book a move across the Humber Bridge?", a: "Yes. Enter your pickup and drop-off and you'll see your price, including jobs to and from North Lincolnshire." },
    driver: { note: "Hull jobs run along the A63 and M62, with port and industrial work around the docks and Saltend.", faq: { q: "Are there jobs around the Port of Hull?", a: "Customers post all kinds of jobs, which can include collections and deliveries around the port and Saltend. Read the job details and access notes before you bid." } },
  },
  {
    slug: "edinburgh", name: "Edinburgh", kind: "city", region: "Lothian", services: B3_SERVICES,
    residential: ["Leith", "Morningside", "Portobello", "Corstorphine", "Stockbridge", "Musselburgh"],
    retail: ["St James Quarter", "Princes Street", "Ocean Terminal", "Fort Kinnaird"],
    business: ["Edinburgh city centre", "Edinburgh Park", "the Exchange district", "Leith"],
    industrial: ["Sighthill", "Newbridge", "Granton", "Straiton"],
    roads: ["A720 City Bypass", "M8", "M9", "A1"],
    parking: "Edinburgh's Old Town has steep, cobbled streets and much of the city has controlled parking, so plan where the driver can stop.",
    cleanAir: { text: "Edinburgh has a Low Emission Zone in the city centre. Check whether your vehicle is affected.", url: "https://www.lowemissionzones.scot/", label: "Low Emission Zones Scotland" },
    character: "Edinburgh is Scotland's capital, ringed by the A720 City Bypass, with Leith and the Firth of Forth to the north.",
    nearby: [["glasgow", "M8"], ["newcastle", "A1"], ["aberdeen", "M90 and A90"]],
    localFaq: { q: "Do you cover Leith, Musselburgh and the Lothians?", a: "Yes. Drivers cover all of Edinburgh, plus Leith, Musselburgh, Dalkeith, Livingston and nearby towns." },
    driver: null,
  },
  {
    slug: "cardiff", name: "Cardiff", kind: "city", region: "South Wales", services: B3_SERVICES,
    residential: ["Canton", "Roath", "Pontcanna", "Llandaff", "Whitchurch", "Penarth"],
    retail: ["St David's", "Queen Street", "Mermaid Quay", "Cardiff Gate Retail Park"],
    business: ["Cardiff city centre", "Cardiff Bay", "Central Square", "Cardiff Gate Business Park"],
    industrial: ["Wentloog", "Ocean Park", "Tremorfa", "Penarth Road"],
    roads: ["M4", "A48(M)", "A470", "A4232"],
    parking: "Much of Cardiff city centre around Queen Street is pedestrianised and has bus lanes, while suburbs like Whitchurch and Llandaff are usually easier for loading.",
    cleanAir: null,
    character: "Cardiff is the capital of Wales, between the M4 to the north and Cardiff Bay to the south.",
    nearby: [["swansea", "M4"], ["bristol", "M4"], ["plymouth", "M4 and M5"]],
    localFaq: { q: "Do you cover Penarth, Barry and the Valleys?", a: "Yes. Drivers cover all of Cardiff and nearby places like Penarth, Barry, Caerphilly and Pontypridd." },
    driver: null,
  },
  {
    slug: "southampton", name: "Southampton", kind: "city", region: "Hampshire", services: B3_SERVICES,
    residential: ["Shirley", "Bitterne", "Portswood", "Woolston", "Hedge End", "Eastleigh"],
    retail: ["WestQuay", "the Bargate", "Hedge End Retail Park", "Shirley High Street"],
    business: ["Southampton city centre", "Ocean Village", "Chilworth Science Park", "the Western Docks"],
    industrial: ["the Western Docks", "Nursling", "Millbrook", "Hedge End"],
    roads: ["M27", "M3", "M271", "A33"],
    parking: "Traffic around the docks can be heavy on cruise days, and the Itchen Bridge is tolled, so plan the route and timings.",
    cleanAir: null,
    character: "Southampton is a port city on the M27 and M3, home to busy cruise and container docks.",
    nearby: [["portsmouth", "M27"], ["oxford", "A34"], ["reading", "M3 and A33"], ["brighton", "M27 and A27"]],
    localFaq: { q: "Can you collect from or deliver to the docks?", a: "Yes. Add the terminal or gate, any booking reference and access times so the driver knows where to go." },
    driver: null,
  },
  {
    slug: "portsmouth", name: "Portsmouth", kind: "city", region: "Hampshire", services: B3_SERVICES,
    residential: ["Southsea", "Fratton", "North End", "Cosham", "Drayton", "Havant"],
    retail: ["Gunwharf Quays", "the Cascades Shopping Centre", "Commercial Road", "Southsea's Palmerston Road"],
    business: ["Portsmouth city centre", "Lakeside North Harbour", "Gunwharf Quays", "the Hard"],
    industrial: ["Portsmouth International Port", "Dunsbury Park", "Railway Triangle", "Fitzherbert Road"],
    roads: ["M27", "M275", "A3(M)", "A27"],
    parking: "Portsea Island has dense terraced streets with tight parking, and most traffic comes on and off the island via the M275, A3 and A2030.",
    cleanAir: { text: "Portsmouth has a Clean Air Zone in the south-west of Portsea Island. Check whether your vehicle is affected.", url: GOV_CAZ, label: "GOV.UK Clean Air Zone checker" },
    character: "Portsmouth is an island city on the south coast, with a naval base and ferry port and the M275 linking it to the M27.",
    nearby: [["southampton", "M27"], ["brighton", "A27"], ["london", "A3(M) and A3"]],
    localFaq: { q: "Can you collect from the ferry port?", a: "Yes. Add the terminal, any booking reference and arrival times so the driver knows where to meet you." },
    driver: { note: "Portsmouth jobs run off the M275 and A27, with the M27 linking to Southampton.", faq: { q: "Is getting on and off Portsea Island slow?", a: "The M275, A3 and A2030 are the main routes on and off the island and can be busy at peak times. Plan your timings and price accordingly." } },
  },
  {
    slug: "reading", name: "Reading", kind: "town", region: "Berkshire", services: B3_SERVICES,
    residential: ["Caversham", "Tilehurst", "Earley", "Woodley", "Lower Earley", "Whitley"],
    retail: ["The Oracle", "Broad Street Mall", "Broad Street", "Reading Gate Retail Park"],
    business: ["Reading town centre", "Green Park", "Thames Valley Park", "Arlington Business Park"],
    industrial: ["Portman Road", "Richfield Avenue", "Theale", "Worton Grange"],
    roads: ["M4 junctions 10 to 12", "A33", "A329(M)", "A4"],
    parking: "Reading's inner distribution road has bus lanes and busy junctions, and the Thames bridges to Caversham can be slow at peak times.",
    cleanAir: null,
    character: "Reading is a large Berkshire town on the M4 and the River Thames, with business parks at Green Park and Thames Valley Park.",
    nearby: [["london", "M4"], ["oxford", "A4074"], ["southampton", "A33 and M3"]],
    localFaq: { q: "Do you cover Wokingham, Bracknell and Newbury?", a: "Yes. Drivers cover all of Reading and nearby places like Wokingham, Bracknell, Theale and Newbury." },
    driver: null,
  },
  {
    slug: "oxford", name: "Oxford", kind: "city", region: "Oxfordshire", services: B3_SERVICES,
    residential: ["Headington", "Summertown", "Cowley", "Jericho", "Botley", "Kidlington"],
    retail: ["Westgate", "Cornmarket Street", "Templars Square", "Botley Road"],
    business: ["Oxford city centre", "Oxford Business Park", "the Oxford Science Park", "Begbroke Science Park"],
    industrial: ["Cowley", "Osney Mead", "Kidlington", "Horspath"],
    roads: ["A34", "A40", "Oxford Ring Road", "M40 junctions 8 and 9"],
    parking: "Oxford city centre has narrow streets, bus-only routes and limited loading, while suburbs like Headington and Summertown are usually easier.",
    cleanAir: { text: "Oxford has a Zero Emission Zone in part of the city centre, where most petrol and diesel vehicles pay a daily charge. Check whether your vehicle is affected.", url: "https://www.oxfordshire.gov.uk/transport-and-travel/oxford-zero-emission-zone-zez", label: "Oxfordshire County Council ZEZ" },
    character: "Oxford is a university city ringed by the A34, A40 and ring road, close to the M40.",
    nearby: [["reading", "A4074"], ["milton-keynes", "A41 and A421"], ["southampton", "A34"], ["london", "M40"], ["birmingham", "M40"]],
    localFaq: { q: "Can you collect from a college or student house?", a: "Yes. Add the college or street, any porters' lodge details and loading times so the driver knows where to go." },
    driver: { note: "Oxford jobs run around the ring road, with the A34 and M40 for longer runs.", faq: { q: "Can I drive into Oxford city centre?", a: "Parts of the centre have restrictions, including a Zero Emission Zone and bus-only routes. Check the route before you accept a job." } },
  },
  {
    slug: "plymouth", name: "Plymouth", kind: "city", region: "Devon", services: B3_SERVICES,
    residential: ["Plympton", "Plymstock", "Mutley", "Peverell", "Mannamead", "Stoke"],
    retail: ["Drake Circus", "Armada Way", "Marsh Mills", "the Barbican"],
    business: ["Plymouth city centre", "the Barbican", "Derriford", "Plymouth Science Park"],
    industrial: ["Estover", "Belliver", "Langage Business Park", "Marsh Mills"],
    roads: ["A38 Devon Expressway", "A386", "A374", "A379"],
    parking: "The Barbican has narrow cobbled streets and Plymouth is hilly, so add access notes for steep driveways and tight streets.",
    cleanAir: null,
    character: "Plymouth is a Devon port city on the A38, with the Tamar Bridge into Cornwall to the west.",
    nearby: [["bristol", "A38 and M5"], ["swansea", "M5 and M4"], ["cardiff", "M5 and M4"]],
    localFaq: { q: "Do you cover Cornwall from Plymouth?", a: "Yes. Enter a pickup or drop-off in Cornwall and you'll see your price. Jobs often cross the Tamar Bridge on the A38." },
    driver: { note: "Plymouth jobs run along the A38 Devon Expressway, with the Tamar Bridge into Cornwall.", faq: { q: "Do I pay the Tamar Bridge toll?", a: "The Tamar Bridge toll is charged travelling east from Cornwall into Devon. If a job uses it, include the cost in your price." } },
  },
  {
    slug: "swansea", name: "Swansea", kind: "city", region: "South Wales", services: B3_SERVICES,
    residential: ["Sketty", "Mumbles", "Uplands", "Morriston", "Gorseinon", "Killay"],
    retail: ["the Quadrant Centre", "Swansea Market", "Parc Fforestfach", "Swansea Enterprise Park"],
    business: ["Swansea city centre", "SA1 Swansea Waterfront", "Swansea Enterprise Park", "Swansea Vale"],
    industrial: ["Swansea Enterprise Park", "Swansea West Industrial Estate", "Swansea Vale", "the Port of Swansea"],
    roads: ["M4 junctions 42 to 47", "A483", "A4067", "A48"],
    parking: "Areas like Uplands and Townhill have steep, narrow streets, and Mumbles Road can be busy in summer, so plan where the driver can stop.",
    cleanAir: null,
    character: "Swansea is a coastal city on Swansea Bay in South Wales, at the western end of the M4.",
    nearby: [["cardiff", "M4"], ["bristol", "M4"], ["plymouth", "M4 and M5"]],
    localFaq: { q: "Do you cover Gower, Neath and Llanelli?", a: "Yes. Drivers cover all of Swansea plus nearby places like Gower, Neath, Port Talbot and Llanelli." },
    driver: { note: "Swansea jobs run along the M4 between junctions 42 and 47, with Cardiff further east.", faq: { q: "Can I take jobs between Swansea and Cardiff?", a: "Yes. The M4 links Swansea and Cardiff, and you choose which jobs to bid on or accept." } },
  },
  {
    slug: "milton-keynes", name: "Milton Keynes", kind: "city", region: "Buckinghamshire", services: B3_SERVICES,
    residential: ["Bletchley", "Wolverton", "Newport Pagnell", "Stony Stratford", "Shenley", "Olney"],
    retail: ["centre:mk", "Midsummer Place", "the Kingston Centre", "Xscape"],
    business: ["Central Milton Keynes", "Kents Hill", "Knowlhill", "Bletchley"],
    industrial: ["Magna Park", "Kiln Farm", "Tongwell", "Brinklow"],
    roads: ["M1 junctions 13 and 14", "A5", "A421", "the grid roads"],
    parking: "Milton Keynes is built on a grid of fast roads and roundabouts, so access is usually easy, but some estates have parking courts and footpaths between homes.",
    cleanAir: null,
    character: "Milton Keynes is a planned city built on a grid of roads, on the M1 between London and Birmingham.",
    nearby: [["london", "M1"], ["leicester", "M1"], ["oxford", "A421 and A41"], ["birmingham", "M1 and M6"]],
    localFaq: { q: "Do you cover Bletchley, Newport Pagnell and Olney?", a: "Yes. Drivers cover all of Milton Keynes and nearby places like Bletchley, Newport Pagnell, Olney and Leighton Buzzard." },
    driver: { note: "Milton Keynes sits on the M1 at junctions 13 and 14, with warehouses at Magna Park and around the city.", faq: { q: "Is there warehouse work in Milton Keynes?", a: "Customers post pallet and freight jobs too, which can include warehouses around Magna Park. Check new Bid Jobs and Fixed Price Jobs for work that fits your vehicle." } },
  },
  {
    slug: "brighton", name: "Brighton", kind: "city", region: "East Sussex", services: B3_SERVICES,
    residential: ["Hove", "Kemptown", "Preston Park", "Hanover", "Patcham", "Rottingdean"],
    retail: ["Churchill Square", "North Laine", "The Lanes", "Brighton Marina"],
    business: ["Brighton city centre", "the New England Quarter", "Hollingbury", "Brighton Marina"],
    industrial: ["Hollingbury", "Moulsecoomb", "Shoreham Port", "Portslade"],
    roads: ["A23", "M23", "A27", "A259"],
    parking: "Most of Brighton and Hove has controlled parking, and streets in Hanover and the Lanes are narrow and steep, so plan where the driver can stop.",
    cleanAir: null,
    character: "Brighton is a seaside city on the south coast, linked to London by the A23 and M23, with the A27 along the South Downs.",
    nearby: [["london", "A23 and M23"], ["southampton", "A27 and M27"], ["portsmouth", "A27"]],
    localFaq: { q: "Do you cover Hove, Shoreham and Lewes?", a: "Yes. Drivers cover all of Brighton and Hove and nearby places like Shoreham-by-Sea, Lewes and Worthing." },
    driver: null,
  },
  {
    slug: "aberdeen", name: "Aberdeen", kind: "city", region: "Aberdeenshire", services: B3_SERVICES,
    residential: ["Bridge of Don", "Cults", "Rosemount", "Torry", "Dyce", "Westhill"],
    retail: ["Union Square", "the Bon Accord Centre", "Union Street", "Beach Boulevard"],
    business: ["Aberdeen city centre", "Prime Four", "the harbour", "Dyce"],
    industrial: ["Altens", "Tullos", "Dyce", "Bridge of Don"],
    roads: ["A90", "A96", "AWPR", "A93"],
    parking: "Aberdeen city centre has bus gates and restricted streets around Union Street, while suburbs like Cults and Westhill are usually easier for loading.",
    cleanAir: { text: "Aberdeen has a Low Emission Zone in the city centre. Check whether your vehicle is affected.", url: "https://www.lowemissionzones.scot/", label: "Low Emission Zones Scotland" },
    character: "Aberdeen is a North Sea port city in the north-east of Scotland, with the Aberdeen Western Peripheral Route to the west.",
    nearby: [["edinburgh", "A90 and M90"], ["glasgow", "A90, A9 and M80"]],
    localFaq: { q: "Do you cover Westhill, Dyce and Aberdeenshire towns?", a: "Yes. Drivers cover all of Aberdeen and nearby places like Westhill, Dyce, Portlethen and Inverurie." },
    driver: { note: "Aberdeen jobs run along the AWPR, A90 and A96, with industrial work around Altens, Tullos and Dyce.", faq: { q: "Do I need to know about the Low Emission Zone?", a: "Aberdeen has a Low Emission Zone in the city centre. Check your vehicle meets the standards before taking jobs inside it." } },
  },
  // SEO Phase 4
  ...P4_NORTH_WEST,
  ...P4_YORKSHIRE_NE,
  ...P4_EAST,
  ...P4_SOUTH,
  ...P4_NATIONS,
];

export const LOCAL_PLACE_BY_SLUG = Object.fromEntries(LOCAL_PLACES.map((p) => [p.slug, p]));

const PLACE_LEADS = {
  "man-and-van": { facet: "residential", lead: (c, a) => `Our ${c.name} man and van drivers work in flats and houses across ${list(a)}, as well as the ${c.kind} centre. Small moves, single items and tip runs can all be booked.` },
  "house-removals": { facet: "residential", lead: (c, a) => `Moving home in ${c.name}? Drivers cover areas like ${list(a)}, with vans and lorries for everything from studio flats to family homes.` },
  "furniture-delivery": { facet: "retail", lead: (c, a) => `Bought a sofa or wardrobe at ${list(a)}? Book a driver to collect it from the store or a seller and deliver it to homes in and around ${c.name}.` },
  "same-day-courier": { facet: "business", lead: (c, a) => `Same-day courier jobs in ${c.name} often start around ${list(a)}. Book ASAP for an urgent run or schedule it for later today.` },
  "car-transport": { facet: "roads", lead: (c, a) => `Car transport in ${c.name} covers private sales, dealer moves and non-runners, with transporters using routes like the ${list(a)}.` },
  "vehicle-recovery": { facet: "roads", lead: (c, a) => `Breakdowns around ${c.name} often happen on busy roads like the ${list(a)}. Book 24/7 and ASAP Recovery jobs go to recovery drivers available around the clock nearby.` },
  "marketplace-collection": { facet: "retail", lead: (c, a) => `Found something on a marketplace in ${c.name}? Drivers can collect from sellers across the ${c.kind} and nearby, from shopping areas like ${list(a)} to private homes.` },
  "non-runner-car-transport": { facet: "roads", lead: (c, a) => `Got a car in ${c.name} that won't start or drive? Drivers with recovery vehicles and winches collect from driveways, garages and car parks, using routes like the ${list(a)}.` },
  "van-transport": { facet: "roads", lead: (c, a) => `Need a van moved in or out of ${c.name}? Drivers collect vans from dealers, auctions, businesses and homes, using routes like the ${list(a)}.` },
};

const placeOrCity = (slug) => LOCAL_PLACE_BY_SLUG[slug] || LOCAL_CITY_BY_SLUG[slug];

export function placeNearby(c) {
  if (!c.nearby) return cityRoutes(c);
  return c.nearby.map(([slug, roads]) => ({ to: placeOrCity(slug), roads }));
}

export function placeServices(c) {
  if (!c.services) return [...SERVICE_PAGES, ...LOCAL_EXTRA_SERVICES.map((s) => ALL_SERVICE_BY_SLUG[s])];
  return c.services.map((s) => ALL_SERVICE_BY_SLUG[s]);
}

export const PLACE_SERVICE_PAIRS = [
  ...LOCAL_PLACES.flatMap((c) => placeServices(c).map((s) => [s, c])),
  ...LOCAL_EXTRA_SERVICES.flatMap((slug) => LOCAL_CITIES.map((c) => [ALL_SERVICE_BY_SLUG[slug], c])),
];

export function placeService(service, c) {
  const svcIdx = ALL_SERVICE_PAGES.findIndex((s) => s.slug === service.slug);
  const cfg = PLACE_LEADS[service.slug];
  const pool = cfg.facet === "roads" ? c.residential : c[cfg.facet];
  const areas = pool.map((_, i) => pool[(i + svcIdx) % pool.length]);
  const near = placeNearby(c);
  const routes = near.length <= 3 ? near : [0, 1, 2].map((i) => near[(svcIdx + i) % near.length]);
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

export function placeServiceSeo(service, c) {
  const { areas } = placeService(service, c);
  return {
    path: `/services/${service.slug}/${c.slug}`,
    title: fit(60, `${service.name} in ${c.name} – Instant Quote | Cargo One`, `${service.name} in ${c.name} | Cargo One`, `${service.name} in ${c.name}`),
    h1: `${service.name} in ${c.name} – instant quote`,
    description: fit(155, `${service.name} in ${c.name}, including ${list(areas.slice(0, 2))}. Get an instant quote, book a verified driver and track it live.`, `${service.name} in ${c.name}, including ${areas[0]}. Get an instant quote, book a verified driver and track it live.`, `${service.name} in ${c.name}. Get an instant quote, book a verified driver and track it live.`),
  };
}

export function placeHubSeo(c) {
  const seo = cityHubSeo(c);
  return { ...seo, title: fit(60, seo.title, `Couriers & Man and Van in ${c.name} | Cargo One`, `Couriers in ${c.name} | Cargo One`), description: fit(155, seo.description, `Couriers, man and van, removals and recovery in ${c.name}. Instant quote, book 24/7 and track your driver live.`) };
}

export function placeHubFaqs(c) {
  const r = placeNearby(c);
  return [
    { q: `Which areas of ${c.name} do you cover?`, a: `All of ${c.name} and the surrounding area, from homes in ${list(c.residential.slice(0, 3))} to business and industrial areas like ${list([c.business[1], c.industrial[0]])}.` },
    { q: `Can I book a courier in ${c.name} right now?`, a: "Yes. You can book 24/7. ASAP Transport and ASAP Recovery jobs go to drivers available around the clock near the pickup, and you can follow your driver live once one accepts." },
    { q: `What should I know about parking and access in ${c.name}?`, a: `${c.parking}${c.cleanAir ? ` ${c.cleanAir.text}` : ""}` },
    { q: `Do you do longer journeys from ${c.name}?`, a: `Yes. Popular runs include ${list(r.slice(0, 3).map((x) => `${x.to.name} via the ${x.roads}`))}.` },
    c.localFaq,
    { q: `Which booking types can I use in ${c.name}?`, a: "ASAP Transport, ASAP Recovery, Bid Jobs and Fixed Price Jobs are all available. Choose the one that fits when you book." },
  ];
}

// Driver-page shape (same as DRIVER_CITIES entries) for places without an existing /drivers/jobs page.
export const PLACE_DRIVER_CITIES = LOCAL_PLACES.filter((c) => c.driver).map((c) => ({
  slug: c.slug, name: c.name, region: c.region,
  nearby: placeNearby(c).map((r) => r.to.name),
  areas: [...new Set([...c.business.slice(0, 2), ...c.industrial.slice(0, 3)])],
  routes: c.roads, note: c.driver.note, localFaq: c.driver.faq,
}));

export const PLACE_DRIVER_CITY_BY_SLUG = Object.fromEntries(PLACE_DRIVER_CITIES.map((c) => [c.slug, c]));

export function placeDriverRelated(c) {
  return LOCAL_PLACE_BY_SLUG[c.slug].nearby
    .map(([slug]) => PLACE_DRIVER_CITY_BY_SLUG[slug] || DRIVER_CITY_BY_SLUG[slug])
    .filter(Boolean);
}

// ---------- SEO Phase 3 · Batch 4: London boroughs (/couriers/london/{borough}) ----------
const borough = (slug, name, o) => ({ slug, name, region: "London", ...o });

export const LONDON_BOROUGHS = [
  borough("croydon", "Croydon", {
    districts: ["Croydon town centre", "Purley", "Thornton Heath", "Norbury", "South Norwood", "Addiscombe", "Coulsdon", "New Addington"],
    retail: ["Centrale and the Whitgift Centre", "the Purley Way retail parks", "North End"],
    roads: ["A23 Purley Way", "A232", "A212", "A22 towards the M25"],
    parking: "Croydon town centre has tram lines, bus lanes and pedestrian streets around North End, so loading is easier from side streets or a car park.",
    character: "Croydon is a large south London borough with a busy town centre, the Purley Way retail strip and quick links to the M25.",
    localFaq: { q: "Can you collect from the Purley Way retail parks?", a: "Yes. Add the store name and any collection reference, and a driver can collect and deliver to your home." },
  }),
  borough("barnet", "Barnet", {
    districts: ["Chipping Barnet", "Finchley", "Hendon", "Golders Green", "Edgware", "Mill Hill", "Whetstone", "Colindale"],
    retail: ["Brent Cross Shopping Centre", "The Spires in Barnet", "Golders Green Road"],
    roads: ["A406 North Circular", "A1", "A41", "the start of the M1"],
    parking: "Many streets in Finchley and Golders Green have controlled parking, and the North Circular around Brent Cross can be slow at peak times.",
    character: "Barnet is a large north London borough running from the North Circular to the Hertfordshire border, where the M1 and A1 head north.",
    localFaq: { q: "Do you cover Brent Cross and Colindale?", a: "Yes. Drivers cover all of Barnet, including Brent Cross, Colindale, Hendon and the streets off the A41 and A1." },
  }),
  borough("ealing", "Ealing", {
    districts: ["Ealing Broadway", "Acton", "Southall", "Hanwell", "Greenford", "Northolt", "Perivale"],
    retail: ["the Ealing Broadway Centre", "Southall Broadway", "Westway Cross in Greenford"],
    roads: ["A40 Western Avenue", "A406 North Circular", "A4020 Uxbridge Road", "M4"],
    parking: "Ealing Broadway and Acton have bus lanes and controlled parking, while the industrial areas around Park Royal and Greenford usually have loading space.",
    character: "Ealing is a west London borough on the A40 and North Circular, with Park Royal, one of London's biggest industrial areas, on its eastern edge.",
    localFaq: { q: "Can you collect from Park Royal?", a: "Yes. Add the unit name, loading times and any booking reference so the driver can go straight to the right door." },
  }),
  borough("enfield", "Enfield", {
    districts: ["Enfield Town", "Edmonton", "Palmers Green", "Southgate", "Winchmore Hill", "Ponders End", "Enfield Lock"],
    retail: ["Palace Gardens in Enfield Town", "Edmonton Green", "the Southbury Road retail parks"],
    roads: ["A10 Great Cambridge Road", "A406 North Circular", "M25 junctions 24 and 25", "A1055"],
    parking: "The A10 and North Circular carry heavy traffic, while estates in Southgate and Winchmore Hill usually have room to load.",
    character: "Enfield is London's northernmost borough, with the M25 along its edge and industrial estates around Brimsdown and the Lee Valley.",
    localFaq: { q: "Do you cover Brimsdown and the Lee Valley?", a: "Yes. Drivers cover the whole borough, including the industrial estates at Brimsdown and along the Lee Valley." },
  }),
  borough("brent", "Brent", {
    districts: ["Wembley", "Kilburn", "Willesden", "Harlesden", "Kingsbury", "Neasden", "Kensal Green"],
    retail: ["London Designer Outlet", "Brent Park", "Kilburn High Road"],
    roads: ["A406 North Circular", "A5 Edgware Road", "A40", "M1 at Staples Corner"],
    parking: "On Wembley Stadium event days, roads and parking around Wembley are restricted, so check the date before you book.",
    character: "Brent is a north-west London borough, home to Wembley Stadium and part of the Park Royal industrial area.",
    localFaq: { q: "What happens on Wembley event days?", a: "Event-day parking and road restrictions apply around the stadium. Pick another day if you can, or add extra time and access notes to your job." },
  }),
  borough("newham", "Newham", {
    districts: ["Stratford", "East Ham", "West Ham", "Canning Town", "Forest Gate", "Plaistow", "Beckton", "the Royal Docks"],
    retail: ["Westfield Stratford City", "the Stratford Centre", "Gallions Reach Shopping Park"],
    roads: ["A13", "A406 North Circular", "A12", "A118"],
    parking: "Stratford and Canning Town have busy junctions and bus lanes, and events at ExCeL London and the Olympic Park can add traffic.",
    character: "Newham is an east London borough covering Stratford, the Olympic Park and the Royal Docks, with the A13 and A12 running through.",
    localFaq: { q: "Can you deliver to ExCeL London?", a: "Yes. Add the hall, stand number and the venue's delivery booking details so the driver can get to the right loading area." },
  }),
  borough("wandsworth", "Wandsworth", {
    districts: ["Putney", "Battersea", "Balham", "Tooting", "Wandsworth Town", "Earlsfield", "Southfields", "Nine Elms"],
    retail: ["Southside Wandsworth", "Battersea Power Station", "St John's Road at Clapham Junction"],
    roads: ["A3", "A205 South Circular", "A24", "A214"],
    parking: "Most streets in Wandsworth have controlled parking, and the Wandsworth one-way system can be slow, so add parking notes to your job.",
    character: "Wandsworth is a south-west London borough on the Thames, from Putney and Battersea down to Tooting, with Clapham Junction station at its heart.",
    localFaq: { q: "Can you deliver to the new flats at Nine Elms and Battersea?", a: "Yes. Add the building's loading bay, concierge details and any booking times for lifts." },
  }),
  borough("lambeth", "Lambeth", {
    districts: ["Brixton", "Clapham", "Streatham", "Vauxhall", "Kennington", "Stockwell", "West Norwood", "Waterloo"],
    retail: ["Brixton Village and Market", "Streatham High Road", "Clapham High Street"],
    roads: ["A23", "A3", "A205 South Circular", "A202"],
    tfl: { label: "TfL Congestion Charge", url: "https://tfl.gov.uk/modes/driving/congestion-charge" },
    parking: "The area around Waterloo is inside the Congestion Charge zone, and most Lambeth streets have controlled parking and bus lanes.",
    character: "Lambeth is an inner south London borough stretching from Waterloo and the South Bank down through Brixton to Streatham.",
    localFaq: { q: "Do you cover Brixton and Streatham?", a: "Yes. Drivers cover all of Lambeth, including Brixton, Streatham, Clapham, Vauxhall and Waterloo." },
  }),
  borough("southwark", "Southwark", {
    districts: ["Bermondsey", "Peckham", "Camberwell", "Dulwich", "Borough", "Elephant and Castle", "Rotherhithe", "Walworth"],
    retail: ["Surrey Quays Shopping Centre", "the Old Kent Road retail parks", "Rye Lane in Peckham"],
    roads: ["A2 Old Kent Road", "A202", "A200", "A205 South Circular"],
    tfl: { label: "TfL Congestion Charge", url: "https://tfl.gov.uk/modes/driving/congestion-charge" },
    parking: "The north of the borough, around Borough and London Bridge, is inside the Congestion Charge zone, and streets near Borough Market are narrow and busy.",
    character: "Southwark is an inner south London borough on the Thames, from Borough and Bermondsey down to Peckham and Dulwich.",
    localFaq: { q: "Can you collect from Old Kent Road stores?", a: "Yes. Add the store and any collection reference, and the driver can collect and deliver anywhere in London." },
  }),
  borough("hackney", "Hackney", {
    districts: ["Shoreditch", "Dalston", "Hackney Central", "Stoke Newington", "Homerton", "Clapton", "Hoxton", "Hackney Wick"],
    retail: ["Mare Street", "the Kingsland Shopping Centre", "Broadway Market"],
    roads: ["A10 Kingsland Road", "A107", "A12", "A1207"],
    parking: "Hackney has controlled parking across most streets, plus low-traffic areas where some roads are closed to through traffic, so check the route.",
    character: "Hackney is an east London borough, from Shoreditch and Hoxton in the south to Stoke Newington and Clapton in the north.",
    localFaq: { q: "Do low-traffic areas affect my booking?", a: "Some streets have closures to through traffic. Add access notes and the nearest open road, and the driver can plan the route." },
  }),
  borough("tower-hamlets", "Tower Hamlets", {
    districts: ["Canary Wharf", "Whitechapel", "Bethnal Green", "Bow", "Poplar", "Wapping", "Limehouse", "Mile End", "the Isle of Dogs"],
    retail: ["Canary Wharf", "Brick Lane", "Roman Road Market"],
    roads: ["A13", "A11", "A12", "A1203 The Highway"],
    tfl: { label: "TfL Blackwall and Silvertown tunnels charge", url: "https://tfl.gov.uk/modes/driving/silvertown-blackwall-tunnels-charge" },
    parking: "Canary Wharf has its own estate roads and loading rules, and the Blackwall and Silvertown tunnels have a user charge, so plan the route.",
    character: "Tower Hamlets is an east London borough on the Thames, from Whitechapel and Wapping to Canary Wharf and Bow.",
    localFaq: { q: "Can you deliver to an office in Canary Wharf?", a: "Yes. Add the building, the loading bay and any security booking details so the driver can get in." },
  }),
  borough("islington", "Islington", {
    districts: ["Angel", "Highbury", "Holloway", "Archway", "Finsbury Park", "Barnsbury", "Clerkenwell", "Canonbury"],
    retail: ["Upper Street", "the Nag's Head on Holloway Road", "Chapel Market"],
    roads: ["A1", "A501 City Road", "A503 Seven Sisters Road", "A1 Holloway Road"],
    tfl: { label: "TfL Congestion Charge", url: "https://tfl.gov.uk/modes/driving/congestion-charge" },
    parking: "Islington is densely built, with controlled parking on almost every street. The south of the borough around Clerkenwell is inside the Congestion Charge zone, and match days at the Emirates Stadium add restrictions around Highbury and Holloway.",
    character: "Islington is an inner north London borough, from Clerkenwell and Angel up to Highbury, Holloway and Archway.",
    localFaq: { q: "What about Arsenal match days?", a: "Event-day restrictions apply around the Emirates Stadium. Pick another time if you can, or add access notes so the driver can plan." },
  }),
  borough("hillingdon", "Hillingdon", {
    districts: ["Uxbridge", "Hayes", "Ruislip", "Northwood", "West Drayton", "Harefield", "Yiewsley", "Ickenham"],
    retail: ["The Chimes in Uxbridge", "Ruislip High Street", "Hayes town centre"],
    roads: ["M4", "M40", "M25", "A40"],
    parking: "Roads around Heathrow are busy at all hours, while suburbs like Ruislip and Ickenham usually have driveways.",
    character: "Hillingdon is London's westernmost borough, home to Heathrow Airport, with the M4, M40 and M25 all running through or along it.",
    localFaq: { q: "Can you collect from or deliver near Heathrow?", a: "Yes. Add the exact address, cargo shed or unit, and any reference so the driver knows where to go." },
  }),
  borough("bromley", "Bromley", {
    districts: ["Bromley town centre", "Beckenham", "Orpington", "Chislehurst", "Penge", "West Wickham", "Biggin Hill", "Petts Wood"],
    retail: ["The Glades", "Bromley High Street", "Orpington High Street"],
    roads: ["A21", "A232", "A20", "M25 junction 4"],
    parking: "Bromley town centre has pedestrian areas around the High Street, while most of the borough is suburban with driveways.",
    character: "Bromley is London's largest borough by area, running from Penge and Beckenham to the countryside around Biggin Hill.",
    localFaq: { q: "Do you cover Biggin Hill and the villages?", a: "Yes. Drivers cover all of Bromley, including Biggin Hill, Downe and the villages towards the M25." },
  }),
  borough("lewisham", "Lewisham", {
    districts: ["Lewisham", "Catford", "Deptford", "New Cross", "Forest Hill", "Sydenham", "Blackheath", "Brockley"],
    retail: ["the Lewisham Shopping Centre", "Deptford High Street", "Catford Broadway"],
    roads: ["A2", "A20", "A21", "A205 South Circular"],
    parking: "Lewisham and Catford town centres have busy one-way systems and bus lanes, and many streets have controlled parking.",
    character: "Lewisham is a south-east London borough, from Deptford and New Cross down to Catford and Sydenham.",
    localFaq: { q: "Do you cover Blackheath and Deptford?", a: "Yes. Drivers cover all of Lewisham, including Blackheath, Deptford, New Cross, Catford and Sydenham." },
  }),
];

export const LONDON_BOROUGH_BY_SLUG = Object.fromEntries(LONDON_BOROUGHS.map((b) => [b.slug, b]));
export const LONDON_AREAS_PATH = "/couriers/london/areas";
export const LONDON_BOROUGH_SERVICES = ["man-and-van", "house-removals", "vehicle-recovery", "car-transport"].map((s) => SERVICE_BY_SLUG[s]);

export function boroughSeo(b) {
  return {
    path: `/couriers/london/${b.slug}`,
    title: fit(60, `Couriers & Man and Van in ${b.name}, London – Instant Quote | Cargo One`, `Couriers & Man and Van in ${b.name}, London | Cargo One`, `Couriers in ${b.name}, London | Cargo One`),
    h1: `Couriers and man and van in ${b.name}`,
    intro: `${b.character} Get an instant quote for any job in ${b.name}, book 24/7, and track your verified driver live.`,
    description: `Couriers, man and van, removals and recovery in ${b.name}, including ${list(b.districts.slice(0, 2))}. Instant quote, book 24/7 and track your driver live.`,
  };
}

export function boroughFaqs(b) {
  return [
    { q: `Which parts of ${b.name} do you cover?`, a: `All of ${b.name}, including ${list(b.districts.slice(0, 5))}, and anywhere else in London.` },
    { q: `Can I book a courier in ${b.name} right now?`, a: "Yes. You can book 24/7. ASAP Transport and ASAP Recovery jobs go to drivers available around the clock near the pickup, and you can follow your driver live once one accepts." },
    { q: `What should I know about parking and access in ${b.name}?`, a: `${b.parking} ${LOCAL_CITY_BY_SLUG.london.cleanAir.text}` },
    b.localFaq,
    { q: `Which booking types can I use in ${b.name}?`, a: "ASAP Transport, ASAP Recovery, Bid Jobs and Fixed Price Jobs are all available. Choose the one that fits when you book." },
  ];
}

const londonCrumbs = [["Home", "/"], ["Couriers", "/couriers"], ["London", "/couriers/london"], ["London areas", LONDON_AREAS_PATH]];

export function boroughJsonLd(b, faqs) {
  return [faqJsonLd(faqs), breadcrumbJsonLd([...londonCrumbs, [b.name, `/couriers/london/${b.slug}`]])];
}

export const LONDON_AREAS_SEO = {
  path: LONDON_AREAS_PATH,
  title: "London Couriers & Man and Van by Borough | Cargo One",
  h1: "Couriers and man and van across London",
  intro: "Find local pages for London boroughs, from Croydon and Bromley to Barnet, Enfield and Hillingdon. Get an instant quote, book 24/7 and track your driver live.",
  description: "Couriers, man and van, removals and recovery in London boroughs including Croydon, Barnet, Ealing and Newham. Instant quote and live tracking.",
};

export const LONDON_AREAS_FAQS = [
  { q: "Do you cover every London borough?", a: "Yes. You can book a job anywhere in London. These pages cover some of the boroughs we're asked about most." },
  { q: "Does the ULEZ affect my booking?", a: LOCAL_CITY_BY_SLUG.london.cleanAir.text },
  { q: "Can I book across London, for example Croydon to Barnet?", a: "Yes. Enter any pickup and drop-off in London and you'll see your price straight away." },
];

export function londonAreasJsonLd() {
  return [faqJsonLd(LONDON_AREAS_FAQS), breadcrumbJsonLd(londonCrumbs)];
}

// ---------- SEO Phase 3 · Batch 5: guides (/guides, /guides/{slug}) ----------
// No prices or pound figures anywhere in guides; cost guides cover cost factors only.
const BT = {
  bid: ["Bid Jobs", "/how-it-works/bid-jobs"],
  fixed: ["Fixed Price Jobs", "/how-it-works/fixed-price-jobs"],
  asap: ["ASAP Transport", "/how-it-works/asap-transport"],
  recovery: ["ASAP Recovery", "/how-it-works/asap-recovery"],
};
const SV = (slug) => [ALL_SERVICE_BY_SLUG[slug].name, `/services/${slug}`];
const COST_FACTORS_FAQ = { q: "Why don't you publish a price list?", a: "Every job is different. Distance, size, access, vehicle and timing all change the price, so you get a price for your exact job when you enter the details instead of a range that may not apply." };

const GUIDES_BASE = [
  {
    slug: "how-much-does-furniture-delivery-cost", image: "furniture",
    title: "How Much Does Furniture Delivery Cost? | Cargo One",
    h1: "How much does furniture delivery cost?",
    description: "The factors that affect the cost of furniture delivery, from size and distance to stairs, timing and vehicle, and how to get a price for your job.",
    intro: "There's no single price for furniture delivery, because no two jobs are the same. A bedside table across town and a corner sofa up three flights of stairs are very different jobs. This guide explains the factors that shape the cost, so you know what drivers are pricing and how to describe your job to get an accurate quote.",
    sections: [
      { h: "Size and weight of the item", p: ["The biggest factor is what you're moving. Larger and heavier pieces need a bigger vehicle, more space in the load area and often a second person to carry them. A sofa, wardrobe or dining table takes up far more room than a chair or a flat-packed box.", "Measure the height, width and depth of each item and estimate its weight if you can. Mention anything awkward, such as a sofa with fixed arms or a glass tabletop. Accurate details help match a vehicle that fits first time."] },
      { h: "Distance and route", p: ["Longer journeys take more time and fuel, so distance plays a big part. Routes matter too. A run on a motorway is usually quicker than the same distance through busy town centres, and tolls, bridges or charging zones can add to a driver's costs.", "If your item is going a long way, think about whether the date is flexible. Drivers already heading in that direction may be able to offer a better price."] },
      { h: "Access at pickup and drop-off", p: ["Access often affects the cost as much as distance. Stairs, narrow hallways, tight corners and long walks from the parking spot all add time and effort. A ground-floor flat with parking outside is quicker than a top-floor flat with no lift.", "Tell drivers about:"], list: ["The floor number and whether there's a lift", "How far the vehicle can park from the door", "Narrow stairs, tight turns or low doorways", "Parking restrictions or permits needed"] },
      { h: "How many people are needed", p: ["Some items can be moved by one driver. Heavier or bulkier pieces need two people to carry safely. If you can help carry, say so in the job. If you need full help loading and unloading, make that clear so drivers can plan and price for it."] },
      { h: "Vehicle type", p: ["Small items fit in a small van, while large or multiple items need a long wheelbase or Luton van. Very heavy pieces may need a van with a tail lift. The vehicle needed is one of the main things that sets the price, which is why accurate sizes matter."] },
      { h: "Timing and urgency", p: ["If you need something moved today, ASAP Transport sends your job to nearby drivers who are online. If you can wait, scheduling ahead gives drivers time to fit your job around others. Weekends, bank holidays and the end of the month can be busier, so flexible dates can help."] },
      { h: "Assembly, packing and extras", p: ["Dismantling, reassembly and packing are not included as standard. If an item needs taking apart to get it out of the room, do this before the driver arrives or mention it in the job. Wrapping items in blankets or bubble wrap protects them and reduces the chance of damage."] },
      { h: "How to get a price for your job", p: ["Enter your pickup, drop-off and items to see an instant price. You can also post the job as a Bid Job and drivers send you their own quotes, or set your own price with a Fixed Price Job and let drivers accept it. Whichever you choose, you can follow your driver live and get photo proof of delivery."] },
    ],
    faqs: [
      COST_FACTORS_FAQ,
      { q: "Is it cheaper to collect from a shop than a private seller?", a: "Not necessarily. The price depends on distance, size, access and timing rather than who is selling. Shops may have loading bays, which can make collection quicker." },
      { q: "Can I compare quotes from different drivers?", a: "Yes. Post your job as a Bid Job and approved drivers with suitable vehicles can send quotes, so you can choose the one that suits you." },
    ],
    links: [SV("furniture-delivery"), SV("single-item-delivery"), SV("man-and-van"), BT.bid, BT.fixed, BT.asap],
  },
  {
    slug: "how-much-does-car-transport-cost", image: "vehicles",
    title: "How Much Does Car Transport Cost? | Cargo One",
    h1: "How much does car transport cost?",
    description: "What affects the cost of moving a car on a transporter: distance, vehicle size, whether it runs, open or enclosed transport, access and timing.",
    intro: "Car transport prices vary widely because every vehicle and journey is different. A small hatchback that drives onto a trailer is a simpler job than a low sports car that needs an enclosed trailer, or a non-runner that has to be winched. This guide explains what drivers consider when they price a car move.",
    sections: [
      { h: "Distance and route", p: ["Distance is the starting point. Longer journeys mean more fuel, more driving time and sometimes an overnight stop. The route matters too, as motorways are usually quicker than rural roads, and tolls, bridges or clean air zones can add costs.", "A one-way trip can also mean an empty return for the driver. If your dates are flexible, a driver already travelling your way may be able to take the job."] },
      { h: "Size and weight of the vehicle", p: ["Small cars fit most transporters. Large SUVs, pickups, vans and long-wheelbase vehicles may need a bigger transporter or recovery truck. Tell drivers the make, model and any modifications, such as roof boxes, tow bars or lowered suspension."] },
      { h: "Whether the car runs", p: ["A car that starts, steers and brakes can be driven onto the transporter. A non-runner needs a winch, skates or a vehicle with a crane, and often more time to load. Say exactly what works and what doesn't: whether it rolls, whether the wheels turn and whether you have the keys."] },
      { h: "Open or enclosed transport", p: ["Most cars travel on open transporters or trailers. Classic, prestige or newly restored cars are often moved on enclosed trailers to protect them from weather and road debris. Enclosed transport usually needs a specialist vehicle, which can affect the price."] },
      { h: "Access at collection and delivery", p: ["Transporters and recovery trucks need space to load. Narrow lanes, low bridges, tight car parks and underground garages can make collection harder. Tell drivers about:"], list: ["Height limits in car parks", "Whether the car is in a garage, driveway or on the street", "Whether the road is wide enough for a large vehicle", "Gate codes, keys and contact details at each end"] },
      { h: "Timing and urgency", p: ["Urgent jobs, such as moving a car that's broken down, can be booked 24/7 as ASAP Recovery. Planned moves, such as collecting a car you've bought, can be scheduled for a date that suits you. Flexible dates give drivers more chance to fit your car in."] },
      { h: "Collecting from dealers and auctions", p: ["If the car is at a dealer or auction, add the collection address, opening hours and any release paperwork the site needs. Delays at the gate can add time to the job, so having everything ready helps."] },
      { h: "How to get a price", p: ["Enter the collection and delivery addresses and the vehicle details to see an instant price. You can also post your car as a Bid Job, where approved drivers with suitable vehicles send quotes, or set your own price as a Fixed Price Job. Once a driver accepts, you can follow the car on the map and get photo proof at delivery."] },
    ],
    faqs: [
      COST_FACTORS_FAQ,
      { q: "Does a non-runner cost more to move?", a: "It can. Non-runners usually need a winch or a recovery vehicle and more time to load. Describe exactly what works so drivers can price accurately." },
      { q: "Can I book car transport for a specific date?", a: "Yes. Pick a date when you post the job. For urgent breakdowns, book ASAP Recovery instead." },
    ],
    links: [SV("car-transport"), SV("non-runner-car-transport"), SV("classic-car-transport"), SV("vehicle-recovery"), BT.bid, BT.fixed, BT.recovery],
  },
  {
    slug: "how-much-do-house-removals-cost", image: "house_moves",
    title: "How Much Do House Removals Cost? | Cargo One",
    h1: "How much do house removals cost?",
    description: "The factors behind house removal costs: how much you're moving, distance, access, number of movers, vehicle size and moving date.",
    intro: "The cost of a house move depends on what you're moving, how far it's going and how easy it is to load and unload. Two homes with the same number of bedrooms can need very different moves. This guide sets out the factors that matter, so you can describe your move clearly and get an accurate price.",
    sections: [
      { h: "How much you're moving", p: ["The volume of belongings is the biggest factor. A studio flat may fit in one van, while a family home may need a Luton van, a lorry or more than one trip. List your large items, such as beds, wardrobes, sofas, white goods and tables, and give a rough number of boxes.", "Clearing out before you move reduces the load. Selling, donating or recycling items you no longer need can make a real difference."] },
      { h: "Distance", p: ["Local moves are usually done in a day, often with time to spare. Long-distance moves take more driving time and fuel, and very long moves may need two days. The route, tolls and clean air zones can also add to a driver's costs."] },
      { h: "Access at both properties", p: ["Access affects how long loading and unloading takes. Stairs, lifts, long walks from the van and narrow corridors all add time. Tell drivers about:"], list: ["Floor levels and whether there's a lift", "Parking outside each property and any permits", "Narrow stairs, tight turns or low ceilings", "Items that need to go through windows or be hoisted"] },
      { h: "Number of movers", p: ["A small move may need one driver. Larger moves usually need two or more people to load safely and quickly. If friends or family are helping, mention it in the job. If you need full help with every item, make that clear."] },
      { h: "Vehicle size", p: ["The vehicle is matched to the volume of your belongings. Choosing one that's too small can mean extra trips. Choosing the right size from the start keeps the move simple. Lorries and vans with tail lifts can help with very heavy items."] },
      { h: "Moving date and time", p: ["Fridays, weekends, the end of the month and school holidays are often busy. If you can move midweek or have flexible dates, drivers have more chance to fit you in. You can book ahead as soon as you know your date."] },
      { h: "Packing and extra services", p: ["Packing, dismantling furniture and reassembly are not included as standard. Having everything packed, labelled and ready before the driver arrives saves time. Clearly mark fragile boxes and keep essentials, like documents, chargers and medicines, with you."] },
      { h: "How to get a price for your move", p: ["Enter your addresses and list your items to see an instant price. For larger moves, you can post the job as a Bid Job and approved drivers with suitable vehicles can send quotes. Or set your own price with a Fixed Price Job. On the day, you can follow your driver live."] },
    ],
    faqs: [
      COST_FACTORS_FAQ,
      { q: "Will it cost more if I have lots of stairs?", a: "Stairs and long carries take more time and effort, so they can affect the price. Describe access at both properties so drivers can price accurately." },
      { q: "How far ahead should I book a house move?", a: "As soon as you know your moving date. Booking early gives you the most choice of drivers, especially for busy dates." },
    ],
    links: [SV("house-removals"), SV("long-distance-removals"), SV("man-and-van"), SV("student-moves"), BT.bid, BT.fixed],
  },
  {
    slug: "house-move-checklist", image: "heroSeoBoxes",
    title: "House Move Checklist: What to Do and When | Cargo One",
    h1: "House move checklist",
    description: "A practical house move checklist: what to sort before moving day, how to pack, what to do on the day, and what to check once you're in.",
    intro: "Moving home is easier when you break it into steps. This checklist covers the main jobs to do in the weeks before your move, on moving day and once you've arrived. Use it alongside your own plans, and tick things off as you go.",
    sections: [
      { h: "As soon as you have a moving date", p: ["Start early with the jobs that take the longest to arrange."], list: ["Book your move and choose the vehicle size you need", "Tell your landlord or agree completion dates with your solicitor", "Check parking at both addresses and apply for permits if needed", "Start clearing out items you don't want to take", "Collect boxes, tape, marker pens and protective wrap"] },
      { h: "Two to three weeks before", p: ["Begin packing rooms you use least, such as lofts, spare rooms and garages. Label each box with its room and a short description of what's inside. Keep a simple list of boxes so you can check nothing goes missing."], list: ["Tell utility suppliers, your council and your bank your new address", "Arrange post redirection", "Update your address with your GP, dentist and employer", "Plan how pets and children will be looked after on the day"] },
      { h: "The week before", p: ["Pack most of your belongings, leaving only daily essentials. Dismantle furniture that won't fit through doors and keep screws in labelled bags taped to the furniture. Defrost the freezer if it's moving with you."], list: ["Confirm the time and addresses with your driver in the app", "Check access notes are up to date", "Pack an essentials box: kettle, mugs, toiletries, chargers, medicines, bedding", "Keep important documents and valuables with you, not in the van"] },
      { h: "The day before", p: ["Finish packing and make sure every box is sealed and labelled. Clear a path through the house so items can be carried out easily. If you need to reserve a parking space, check it's in place. Charge your phone so you can follow your driver live on the day."] },
      { h: "On moving day", p: ["Be ready for the driver to arrive and show them what's going and what's staying. Point out fragile items and heavy boxes. Before the van leaves, walk through every room, cupboard, loft and garden shed to check nothing is left behind."], list: ["Take meter readings at the old property", "Lock windows and doors and hand back keys", "Follow your driver on the map and meet them at the new address", "Direct boxes to the right rooms as they come in"] },
      { h: "Once you've moved in", p: ["Take meter readings at the new property and check the heating, hot water and smoke alarms work. Unpack the essentials box first and make up beds early so you can rest. Check items for damage as you unpack and raise anything straight away."] },
      { h: "Booking the right move", p: ["For a small flat or a few items, a man and van is often enough. For a whole house, choose a larger van or lorry and say how many people you need. You can get an instant price, post a Bid Job to receive quotes from approved drivers, or set your own price with a Fixed Price Job."] },
    ],
    faqs: [
      { q: "When should I start packing?", a: "Start two to three weeks before with rooms you use least, then pack the rest in the final week. Leave daily essentials until the last day." },
      { q: "What should I keep with me on moving day?", a: "Keep documents, keys, valuables, medicines, chargers and an essentials box with you rather than in the van." },
      { q: "Can I change my booking details before the move?", a: "Keep your addresses, timings and access notes up to date in the app so your driver has the latest information." },
    ],
    links: [SV("house-removals"), SV("man-and-van"), SV("long-distance-removals"), SV("student-moves"), BT.bid, BT.fixed],
  },
  {
    slug: "how-to-collect-a-marketplace-or-ebay-purchase", image: "auction_marketplace",
    title: "How to Collect a Marketplace or eBay Purchase | Cargo One",
    h1: "How to collect a marketplace or eBay purchase",
    description: "How to arrange collection of an item bought on eBay, Facebook Marketplace or Gumtree: agreeing with the seller, measuring, staying safe and booking.",
    intro: "Buying second-hand online is a great way to find furniture, appliances and more, but many listings are collection only. If you don't have a suitable vehicle, you can book a driver to collect it for you. This guide explains how to arrange a smooth collection and avoid common problems.",
    sections: [
      { h: "Check the listing before you buy", p: ["Before you commit, check the item's size, weight and condition. Ask the seller for measurements if they aren't listed, and for photos of any damage. Confirm the item is available and that the seller is happy for a driver to collect on your behalf."] },
      { h: "Agree collection details with the seller", p: ["Arrange a collection window that suits the seller, and ask about access. Sellers often know whether there are stairs, a lift or parking outside."], list: ["The collection address and a contact phone number", "A time window the seller will be in", "Floor level, lifts and parking", "Whether the seller can help carry the item"] },
      { h: "Pay safely", p: ["Use the platform's own payment and buyer protection options where available. Be cautious of sellers who ask for unusual payment methods or pressure you to pay before you've confirmed the item exists. If you're paying on collection, agree with the seller how this will work before the driver arrives."] },
      { h: "Measure where it's going", p: ["Measure doorways, hallways and stairs at your home as well as the item. A sofa that fits the room but not the front door can cause problems on delivery day. If it needs to be taken apart, agree with the seller who will do it before collection."] },
      { h: "Describe the item clearly", p: ["When you book, add the item's size, rough weight and a photo or link to the listing. Mention anything fragile, such as glass, mirrors or electrical items. Clear details help drivers bring the right vehicle and protection."] },
      { h: "Book the collection", p: ["If you need it collected quickly, ASAP Transport sends your job to nearby drivers who are online. If the seller has given you a later date, schedule the job for then. You can also post it as a Bid Job and compare quotes, or set your own price with a Fixed Price Job."] },
      { h: "On collection day", p: ["Share the driver's details with the seller if needed, and keep your phone handy in case the driver or seller has questions. You can follow the driver live on the map. When the item arrives, check it over before the driver leaves and you'll get photo proof of delivery."] },
    ],
    faqs: [
      { q: "Do I need to be at the seller's address?", a: "No. The driver collects from the seller and delivers to you. Make sure the seller knows a driver is coming and add their contact details to the job." },
      { q: "What if the item is bigger than the listing said?", a: "Ask the seller for measurements before booking. If the item is much larger than described, the driver may not be able to take it in the vehicle booked." },
      { q: "Can a driver collect from an auction house?", a: "Yes. Add the lot number, any collection reference and the auction house's opening times." },
    ],
    links: [SV("marketplace-collection"), SV("furniture-delivery"), SV("single-item-delivery"), BT.asap, BT.bid, BT.fixed],
  },
  {
    slug: "how-to-choose-a-courier-or-man-and-van", image: "heroServices",
    title: "How to Choose a Courier or Man and Van | Cargo One",
    h1: "How to choose a courier or man and van",
    description: "What to look for when choosing a courier or man and van: the right vehicle, clear pricing, driver checks, tracking, proof of delivery and reviews.",
    intro: "Whether you're moving a sofa, sending documents or clearing a flat, choosing the right driver makes the job easier. This guide covers what to look for, what to ask and how to describe your job so you get the right vehicle and a clear price.",
    sections: [
      { h: "Courier or man and van?", p: ["A courier service is usually best for parcels, documents and smaller items that just need moving from A to B. A man and van suits bulky items, furniture and small moves where you need help carrying. For whole house moves, look at removals with a larger vehicle and more people."] },
      { h: "Match the vehicle to the job", p: ["The right vehicle avoids extra trips and wasted cost. Small vans suit a few boxes or a single item. Long wheelbase and Luton vans suit furniture and flat moves. Vans with tail lifts help with heavy items, and lorries suit large house moves or pallets. Give accurate sizes so the vehicle fits first time."] },
      { h: "Look for clear pricing", p: ["You should know the price before you book. Be clear about what's included, such as help carrying, waiting time and extra stops. On Cargo One, you see a price for your job when you enter the details, or you can compare quotes from approved drivers with a Bid Job."] },
      { h: "Check the driver is verified", p: ["Drivers should be checked before they can take jobs. On Cargo One, drivers upload their documents and are reviewed before their account is activated, and you can see who's coming once a driver accepts."] },
      { h: "Tracking and proof of delivery", p: ["Live tracking means you know when your driver is on the way, and photo proof of delivery shows the item arrived safely. Both are useful when you're sending something to someone else or can't be there yourself."] },
      { h: "Questions to ask before you book", p: ["A few questions can avoid problems on the day:"], list: ["Will the driver help carry, or do I need to help?", "Is the vehicle big enough for everything?", "What happens if there are stairs or no parking?", "Can the driver bring blankets and straps for fragile items?"] },
      { h: "Describe your job well", p: ["The better your description, the smoother the job. Add sizes, weights, floor levels, parking details and photos. Mention anything fragile or valuable, and check whether you need your own insurance for very valuable items."] },
      { h: "Choose how to book", p: ["Use ASAP Transport if you need it done now. For planned jobs, post a Bid Job to receive quotes from approved drivers, or set your own price with a Fixed Price Job and let a driver accept it."] },
    ],
    faqs: [
      { q: "How do I know the driver can handle my job?", a: "Describe the job in detail. Drivers see sizes, access and notes before they accept, so they can check their vehicle is suitable." },
      { q: "Is a man and van cheaper than a removal company?", a: "It depends on the job. For smaller moves a man and van can be a good fit. Enter your details to see a price for your exact job." },
      { q: "Can I book for the same day?", a: "Yes. Choose ASAP Transport and your job goes to nearby drivers who are online." },
    ],
    links: [SV("man-and-van"), SV("same-day-courier"), SV("house-removals"), SV("parcel-delivery"), BT.asap, BT.bid, BT.fixed],
  },
  {
    slug: "what-to-do-if-your-car-breaks-down", image: "/images/recovery-truck-hero.webp",
    title: "What to Do If Your Car Breaks Down | Cargo One",
    h1: "What to do if your car breaks down",
    description: "Safety first: get to a safe place, switch on hazard lights and call 999 if you're in danger. Then how to arrange recovery with ASAP Recovery.",
    intro: "A breakdown can be stressful, but your safety comes first. Before you think about recovery, make sure you and your passengers are safe. If anyone is in danger, call 999 straight away. Once everyone is safe, you can arrange for your vehicle to be recovered. This guide explains what to do, step by step.",
    sections: [
      { h: "1. Get to a safe place", p: ["If you can, move the car off the road or onto the hard shoulder, a verge or an emergency area. Switch on your hazard lights. If it's dark or visibility is poor, keep your sidelights on too.", "On a motorway or fast road, leave the car by the left-hand door and get behind a safety barrier if there is one. Keep well away from moving traffic and don't stand between your car and the road. Don't try to repair the car yourself on a motorway."] },
      { h: "2. Call 999 if you're in danger", p: ["If you feel you or anyone else is in danger, or the car has stopped in a live lane and you can't get out safely, call 999 immediately. Keep your seatbelt on and hazard lights on if you can't leave the vehicle safely. On a motorway, you can also use an emergency phone to contact the traffic officers."] },
      { h: "3. Keep yourself visible and warm", p: ["Wear bright or reflective clothing if you have it. Don't use a warning triangle on a motorway, as it isn't safe to walk back along the hard shoulder. On other roads, only place one if it's safe to do so. In cold or wet weather, keep warm and dry while you wait away from traffic."] },
      { h: "4. Work out what's wrong", p: ["Only once you're safe, note any warning lights, noises or smells, and whether the car will start. This helps a recovery driver bring the right vehicle. Note your exact location using road signs, marker posts, junction numbers or the location on your phone."] },
      { h: "5. Book ASAP Recovery", p: ["You can book ASAP Recovery 24/7. Enter where the car is, where it needs to go and what's wrong. Your job goes to recovery drivers available around the clock near you, and you can see when one accepts and follow them on the map.", "Include clear details so the right vehicle comes:"], list: ["The make, model and size of the vehicle", "Whether it rolls, steers and brakes", "Whether you have the keys", "Exactly where the car is and which way it's facing"] },
      { h: "6. While you wait", p: ["Stay somewhere safe, away from traffic. Keep your phone charged and nearby so the driver can contact you. If your situation changes and you feel unsafe, call 999."] },
      { h: "7. When the recovery driver arrives", p: ["Check the driver and vehicle match the details in the app. Tell them anything you've noticed about the fault. The driver will load the car and take it to the address you chose, such as your home or a garage, and you'll get photo proof at drop-off."] },
      { h: "If the car isn't urgent", p: ["If the car is already safe, for example on a driveway, you don't need an ASAP job. You can schedule a recovery for later, post a Bid Job to receive quotes, or set your own price with a Fixed Price Job."] },
    ],
    faqs: [
      { q: "What's the first thing I should do if I break down?", a: "Get yourself and your passengers to a safe place and switch on your hazard lights. If anyone is in danger, call 999." },
      { q: "Can I book recovery at night?", a: "Yes. You can book ASAP Recovery 24/7, and your job goes to recovery drivers available around the clock near you." },
      { q: "Where can the car be taken?", a: "Anywhere you choose, such as your home, a garage or another address. Add it as the drop-off when you book." },
    ],
    links: [SV("vehicle-recovery"), SV("non-runner-car-transport"), SV("car-transport"), BT.recovery, BT.bid, BT.fixed],
  },
  {
    slug: "how-to-transport-a-non-running-car", image: "/images/recovery-truck-hero.webp",
    title: "How to Transport a Non-Running Car | Cargo One",
    h1: "How to transport a non-running car",
    description: "How to move a car that won't start or drive: describing the fault, access for loading, winches and recovery vehicles, paperwork and booking.",
    intro: "A car that won't start or can't be driven still needs to get to a garage, a new owner or a scrapyard. Moving a non-runner takes a little more planning than a car that drives onto a trailer, but with the right details the job is straightforward. This guide explains what to prepare.",
    sections: [
      { h: "Describe exactly what works", p: ["Not all non-runners are the same. A car with a flat battery that rolls and steers is much easier to load than one with seized brakes or missing wheels. Tell drivers:"], list: ["Whether the car rolls freely", "Whether the steering works and the wheels turn", "Whether the handbrake can be released", "Whether you have the keys", "Any damage, flat tyres or missing parts"] },
      { h: "Choose the right type of vehicle", p: ["Most non-runners are moved on a recovery truck or a transporter with a winch. Cars that won't roll may need skates or a vehicle with a crane. Heavier vehicles, such as large SUVs or vans, may need a larger recovery truck. Accurate details help match a suitable vehicle."] },
      { h: "Check access for loading", p: ["Recovery vehicles need space to line up with the car and winch it on. A car in a tight garage, a narrow lane or an underground car park can be harder to reach. Add notes about height limits, gates, slopes and how close the truck can get. Photos of the car and its surroundings are very helpful."] },
      { h: "Prepare the car", p: ["Remove personal belongings and anything loose. If the car has been stood for a while, check whether tyres are flat and say so. Leave the keys with someone at the address, or arrange to meet the driver."] },
      { h: "Paperwork and ownership", p: ["If you're buying a non-runner, make sure the seller has the right to sell it and that you have the logbook details you need. If the car is going for scrap, use an authorised treatment facility so it's handled properly. Keep any paperwork with you, not in the car."] },
      { h: "Plan the drop-off", p: ["Tell the driver exactly where the car should go and whether someone will be there. Garages and scrapyards have opening hours, so check these before booking. If the car is going to a driveway, make sure there's space to unload."] },
      { h: "Book the move", p: ["If the car needs moving urgently, for example after a breakdown, book ASAP Recovery 24/7. If it's safe where it is, schedule a date, post a Bid Job to receive quotes from approved drivers with suitable vehicles, or set your own price with a Fixed Price Job. You can follow the car live and get photo proof at drop-off."] },
    ],
    faqs: [
      { q: "Can you move a car with no keys?", a: "Often yes, but say so in the job. Without keys the steering may lock, so drivers may need extra equipment." },
      { q: "Can you move a car that won't roll?", a: "Yes, with the right equipment, such as skates or a crane. Describe the problem so a driver with a suitable vehicle can take the job." },
      { q: "Can I book a non-runner collection for a set date?", a: "Yes. Pick a date when you post the job, or book ASAP Recovery if it's urgent." },
    ],
    links: [SV("non-runner-car-transport"), SV("vehicle-recovery"), SV("car-transport"), SV("classic-car-transport"), BT.recovery, BT.bid, BT.fixed],
  },
  {
    slug: "moving-a-static-or-touring-caravan", image: "caravans",
    title: "Moving a Static or Touring Caravan | Cargo One",
    h1: "Moving a static or touring caravan",
    description: "How to prepare for moving a touring or static caravan: sizes and weights, roadworthiness, site access, park rules, wide loads and booking.",
    intro: "Caravans come in very different sizes, from small touring caravans to large static holiday homes. Each needs a different kind of move. This guide explains what to check and prepare, so drivers with suitable vehicles can plan the job properly.",
    sections: [
      { h: "Touring or static?", p: ["Touring caravans are built to be towed and can usually be moved by a driver with a suitable tow vehicle. Static caravans and lodges are much larger and are moved on a flatbed, lowloader or specialist vehicle, often with lifting equipment. Choose the right service when you book."] },
      { h: "Know the size and weight", p: ["Find the length, width and weight of your caravan. For tourers, the weight and hitch type matter for towing. For statics, width is especially important, as very wide units may need permits or escorts on the road. Your caravan's handbook or the manufacturer's plate usually has these details."] },
      { h: "Check a touring caravan is roadworthy", p: ["For towing, the caravan's tyres, brakes, lights and hitch need to be safe. If it's been in storage for a long time, check the tyres for cracks and pressure, and make sure the brakes aren't seized. If you're unsure, say so in the job and describe any known problems."] },
      { h: "Prepare the inside", p: ["Remove or secure loose items, close all windows, roof lights and vents, and lock cupboards. Turn off and disconnect gas bottles. For statics, the park usually arranges disconnecting services, removing skirting and preparing the unit, so check this with them."] },
      { h: "Plan access at both sites", p: ["Access is often the hardest part of a caravan move. Tell drivers about:"], list: ["Gate widths and turning space", "Slopes, soft ground or grass", "Overhead cables and trees", "Park rules, permitted move times and a site contact"] },
      { h: "Wide and abnormal loads", p: ["Large static caravans may be wider than standard road limits. These moves can need extra planning, permits or escorts. Contact us first so we can check what's possible before you post the job."] },
      { h: "Book the move", p: ["Post your caravan move with the full details and photos. Approved drivers with suitable vehicles can send quotes through a Bid Job, or you can set your own price with a Fixed Price Job. Once a driver accepts, you can follow the move live."] },
    ],
    faqs: [
      { q: "Can you move a caravan from a storage site?", a: "Yes. Add the site name, opening times and any gate codes or booking references the driver needs." },
      { q: "Who prepares a static caravan for moving?", a: "This is usually arranged with the holiday park. Check with them and add what's been done to your job." },
      { q: "Can a caravan be moved at short notice?", a: "Touring caravans often can. Static moves usually need more planning, so book as early as you can." },
    ],
    links: [SV("caravan-transport"), SV("static-caravan-transport"), SV("horsebox-and-trailer-transport"), BT.bid, BT.fixed],
  },
  {
    slug: "shipping-container-transport-guide", image: "shipping_containers",
    title: "Shipping Container Transport Guide | Cargo One",
    h1: "Shipping container transport guide",
    description: "How to plan a shipping or storage container move: sizes, weight, site access, ground conditions, crane unloading and booking a suitable vehicle.",
    intro: "Shipping and storage containers are popular for farms, building sites, businesses and homes. Moving one takes the right vehicle and a site that's ready for it. This guide explains what to check before you book, so the delivery goes smoothly.",
    sections: [
      { h: "Container sizes", p: ["The most common sizes are 10, 20 and 40 foot containers, with standard and high-cube heights. The size sets what vehicle is needed and how much space is required on site. Check the exact size before booking, as some containers are converted or modified."] },
      { h: "Weight and contents", p: ["An empty container is heavy, and a loaded one can be much heavier. Tell drivers whether the container is empty or loaded and give an estimated total weight. Loaded containers may need a larger vehicle or crane and careful securing."] },
      { h: "How it will be unloaded", p: ["Containers are usually lifted on and off with a crane on the vehicle, or slid off a tilting bed. If there's a crane or forklift on site, say so. If not, the driver needs a vehicle with its own lifting equipment."] },
      { h: "Prepare the site", p: ["The ground where the container will sit should be firm and level. Soft grass, mud or steep slopes can make placement difficult or unsafe. Check for:"], list: ["Enough space for the vehicle to reach and manoeuvre", "Overhead cables, trees or roofs near the drop spot", "Gate widths and road access to the site", "A firm, level base for the container"] },
      { h: "Permissions and rules", p: ["Some sites need permission for a container, and building sites may have delivery rules and booking times. Check with your landlord, site manager or local council if you're unsure. Add site contacts and any rules to your job."] },
      { h: "Collecting from a depot or private seller", p: ["If you've bought a container, add the collection address, opening times and any release reference. Make sure the seller or depot can load it, or that the driver will be able to lift it."] },
      { h: "Book the move", p: ["Post your container job with the size, weight, photos of the drop spot and access notes. Approved drivers with suitable vehicles can send quotes through a Bid Job, or you can set your own price with a Fixed Price Job. You can follow the delivery live and get photo proof when it's placed."] },
    ],
    faqs: [
      { q: "Can you deliver a container to a farm or field?", a: "Often yes, if the ground is firm enough and the vehicle can reach. Add photos and ground conditions so drivers can check." },
      { q: "Do I need a crane on site?", a: "Not usually. Many vehicles have their own crane. Say whether you have lifting equipment on site when you book." },
      { q: "Can you move a loaded container?", a: "Tell us what's inside and the total weight so a driver with a suitable vehicle can take the job." },
    ],
    links: [SV("shipping-container-transport"), SV("freight-and-haulage"), SV("machinery-haulage"), SV("building-materials-delivery"), BT.bid, BT.fixed],
  },
  {
    slug: "bid-jobs-vs-fixed-price-jobs", image: "heroHow",
    title: "Bid Jobs vs Fixed Price Jobs: Which to Choose | Cargo One",
    h1: "Bid Jobs vs Fixed Price Jobs: which should you choose?",
    description: "The difference between Bid Jobs and Fixed Price Jobs on Cargo One, when each works best, and when to use ASAP Transport or ASAP Recovery instead.",
    intro: "Cargo One gives you four ways to book: ASAP Transport, ASAP Recovery, Bid Jobs and Fixed Price Jobs. For planned jobs, the main choice is between Bid Jobs and Fixed Price Jobs. This guide explains how each one works and which suits different situations.",
    sections: [
      { h: "How Bid Jobs work", p: ["With a Bid Job, you post the details of what you need moving and approved drivers send their own quotes. You can compare the quotes and choose the driver you prefer. Bid Jobs suit jobs where you'd like to see a range of offers, or where the job is unusual and drivers may price it differently."] },
      { h: "How Fixed Price Jobs work", p: ["With a Fixed Price Job, you set the price you want to pay and drivers can accept it. There's no back-and-forth, and you know your price from the start. Fixed Price Jobs suit people who know what they want to pay and want a simple booking."] },
      { h: "When to choose a Bid Job", p: ["Bid Jobs often work well for:"], list: ["Larger or unusual jobs, such as caravans, containers or machinery", "Long-distance moves where prices can vary", "Jobs where you want to compare offers before deciding", "Flexible dates that drivers can fit around other work"] },
      { h: "When to choose a Fixed Price Job", p: ["Fixed Price Jobs often work well for:"], list: ["Regular or repeat jobs where you know a fair price", "Simple jobs with clear sizes and easy access", "Business deliveries where budgets are set", "When you want a quick, simple booking"] },
      { h: "When to use ASAP instead", p: ["If you need something moved now, use ASAP Transport. Your job goes to nearby drivers who are online, and you see when one accepts. If your vehicle has broken down, use ASAP Recovery, which you can book 24/7, with recovery drivers available around the clock."] },
      { h: "Tips for either booking type", p: ["Whichever you choose, give clear details. Sizes, weights, photos, access notes and timings help drivers understand the job. Jobs that are clearly described are easier for drivers to quote for or accept."] },
      { h: "What happens after a driver accepts", p: ["Once a driver accepts your job, you'll see who's coming and can follow them live on the map. For scheduled jobs, you confirm with a deposit once a driver takes it. At delivery, you get photo proof that the job is done."] },
    ],
    faqs: [
      { q: "Can I choose a different booking type later?", a: "You choose the booking type when you post a job. If you'd rather compare quotes than set a price, post it as a Bid Job." },
      { q: "Which is better for a house move?", a: "Many people choose a Bid Job for house moves so they can compare quotes. If you know what you want to pay, a Fixed Price Job is simpler." },
      { q: "Is ASAP Transport the same as a Bid Job?", a: "No. ASAP Transport is for jobs that need doing now and goes to nearby drivers who are online. Bid Jobs are for planned jobs where drivers send quotes." },
    ],
    links: [BT.bid, BT.fixed, BT.asap, BT.recovery, SV("man-and-van"), SV("house-removals")],
  },
  {
    slug: "preparing-items-for-a-courier", image: "parcels",
    title: "Preparing Items for a Courier | Cargo One",
    h1: "Preparing items for a courier",
    description: "How to pack, measure and prepare items for a courier or man and van: packing materials, labelling, measuring, weight and access notes.",
    intro: "A little preparation makes any delivery quicker and safer. Whether you're sending a single parcel, a piece of furniture or a van load of boxes, this guide covers how to pack, measure and describe your items, and what to tell the driver about access.",
    sections: [
      { h: "Choose the right packaging", p: ["Use strong boxes that are the right size for what's inside. Overfilled boxes can split, and half-empty boxes can crush. Fill gaps with paper or bubble wrap so items don't move around."], list: ["Double-walled boxes for heavy items", "Bubble wrap or paper for fragile items", "Blankets or furniture covers for large pieces", "Strong packing tape on every seam"] },
      { h: "Pack fragile items carefully", p: ["Wrap glass, ceramics and electronics individually. Pack them tightly so they can't move, and mark boxes clearly as fragile. For mirrors and pictures, protect corners with cardboard and tape across the glass. Mark the job as fragile so drivers know before they accept."] },
      { h: "Measure everything", p: ["Measure the height, width and depth of each large item. For furniture, measure at the widest points, including arms, legs and handles. Measure doorways and stairs at both addresses too. Accurate sizes help match the right vehicle and avoid surprises on the day."] },
      { h: "Estimate the weight", p: ["Give a rough weight for heavy items and boxes. Drivers use this to choose a suitable vehicle and decide whether two people are needed. Keep individual boxes to a weight that can be carried safely."] },
      { h: "Label clearly", p: ["Label every box with what's inside and where it's going. For deliveries to someone else, add their name and phone number. For multi-drop jobs, label items with the address they're going to."] },
      { h: "Describe access at both ends", p: ["Access affects how long a job takes. Tell drivers about:"], list: ["Floor levels, stairs and lifts", "Where the vehicle can park and any restrictions", "Narrow hallways, gates or tight corners", "Building rules, loading bays or booking times"] },
      { h: "Be ready on the day", p: ["Have everything packed and in one place before the driver arrives. Clear a path to the door. Make sure someone is at the pickup and drop-off, or add a contact who can meet the driver. You can follow your driver live and get photo proof at delivery."] },
      { h: "Book the right job", p: ["Need it moved now? Use ASAP Transport. Planning ahead? Post a Bid Job to compare quotes, or set your own price with a Fixed Price Job."] },
    ],
    faqs: [
      { q: "Will the driver bring packing materials?", a: "Packing isn't included as standard. Pack items before the driver arrives, and ask in the job if you need blankets or straps." },
      { q: "Should I take furniture apart?", a: "If an item won't fit through doors or into the vehicle, dismantle it before the driver arrives and keep fixings in a labelled bag." },
      { q: "What if my items are bigger than I said?", a: "The vehicle booked may not fit them. Measure carefully and update your job before the driver arrives." },
    ],
    links: [SV("same-day-courier"), SV("parcel-delivery"), SV("man-and-van"), SV("fragile-and-high-value-delivery"), BT.asap, BT.bid, BT.fixed],
  },
];

// Further sections and FAQs for each guide.
const GUIDE_MORE = {
  "how-much-does-furniture-delivery-cost": {
    sections: [
      { h: "Multiple items and extra stops", p: ["Moving several pieces at once is usually more efficient than booking separate jobs, as long as they fit in one vehicle. If items are coming from different places, such as a shop and a private seller, add each pickup as a stop. Extra stops add time, so list them all at the start rather than asking the driver to add them on the day."] },
      { h: "Ways to keep the cost down", p: ["You can't change the size of a sofa, but you can make the job easier:"], list: ["Measure carefully so the right vehicle is sent first time", "Have items ready by the door, wrapped and dismantled if needed", "Offer to help carry if you're able to", "Choose a flexible date rather than a fixed time slot", "Check parking in advance so the driver can stop close by"] },
    ],
    faqs: [{ q: "Does furniture delivery include taking items upstairs?", a: "Say exactly where the item needs to go, including floors and stairs. Drivers see this before they accept and can plan the help needed." }],
  },
  "how-much-does-car-transport-cost": {
    sections: [
      { h: "Preparing the car for collection", p: ["Remove personal belongings and loose items, and leave about a quarter of a tank of fuel or some charge if the car runs. Note any existing damage and take your own photos before collection. Make sure the driver has the keys, any locking wheel nut key and details of anything unusual about the car, such as an alarm or immobiliser."] },
      { h: "Ways to keep the cost down", p: ["A few simple steps can make the job easier to price:"], list: ["Give flexible collection dates where you can", "Describe the car's condition accurately", "Make sure there's space for a transporter to load", "Have keys, paperwork and contacts ready at both ends"] },
    ],
    faqs: [{ q: "Can I travel with the car?", a: "No. The car is moved by the driver. You can follow it live on the map and get photo proof at delivery." }],
  },
  "how-much-do-house-removals-cost": {
    sections: [
      { h: "Storage and split moves", p: ["If your new home isn't ready, you may need to move some belongings into storage and the rest later. This means two or more jobs, so plan each one with its own addresses and timings. A split move can still be efficient if you list exactly what's going where."] },
      { h: "Ways to keep the cost down", p: ["You can make a removal simpler and quicker by:"], list: ["Clearing out items you don't need before moving day", "Packing and labelling everything in advance", "Dismantling large furniture beforehand", "Booking a midweek date if you can", "Reserving parking close to both doors"] },
    ],
    faqs: [{ q: "Can I book a smaller van and do two trips?", a: "You can, but two trips add time. It's often simpler to choose a vehicle that fits everything in one go." }],
  },
  "house-move-checklist": {
    sections: [
      { h: "Moving with children and pets", p: ["Moving day can be busy and noisy. If you can, arrange for young children and pets to be looked after elsewhere, or set aside one quiet room with their things. Pack a separate bag with snacks, toys, food, leads and bedding so you don't have to search through boxes at the end of a long day."] },
      { h: "Rooms that need extra attention", p: ["Kitchens, garages and lofts often take longest. Start the loft and garage early, as they're easy to forget. In the kitchen, use up frozen food, clean out the fridge and pack heavy items in small boxes. Keep a set of plates, cutlery and a kettle for the last day."] },
    ],
    faqs: [{ q: "How do I make sure nothing gets left behind?", a: "Before the van leaves, walk through every room, cupboard, loft, shed and garden, and check under stairs and behind doors." }],
  },
  "how-to-collect-a-marketplace-or-ebay-purchase": {
    sections: [
      { h: "Items that need extra care", p: ["Some second-hand items need a little more thought. Fridges and freezers should ideally travel upright and be left to settle before switching on. Washing machines may need transit bolts fitted. Glass tables, mirrors and large televisions need protecting. Ask the seller whether they have original packaging or fittings."] },
      { h: "If the seller can't be there", p: ["If the seller has arranged for someone else to hand over the item, add that person's name and number to the job. Agree a backup plan in case the collection window changes, and keep messages with the seller in one place so details are easy to check."] },
      { h: "Collecting several items at once", p: ["If you've bought more than one item, you can add each pickup as a stop on one job, as long as everything fits in the vehicle. List the items and sizes for each stop so the driver can plan the load."] },
    ],
    faqs: [{ q: "Can the driver check the item before collecting?", a: "Drivers collect what you've agreed with the seller. Check condition and details with the seller before you book." }],
  },
  "how-to-choose-a-courier-or-man-and-van": {
    sections: [
      { h: "Things to watch out for", p: ["Be cautious of prices that seem unusually low, vague descriptions of what's included, or a driver who won't confirm the vehicle size. Make sure you know who is coming and when. Booking through a platform that verifies drivers, shows the price before you book and lets you track the job gives you more confidence."] },
      { h: "Business and regular deliveries", p: ["If you run a business, look for a service that can handle regular runs, different vehicle sizes and urgent jobs. Live tracking and photo proof of delivery help you keep customers updated. You can post jobs whenever you need them."] },
      { h: "After the job", p: ["Check items on arrival and raise any problem straight away. Photo proof of delivery helps if there's a question later. If you were happy with the job, a review helps other customers choose."] },
    ],
    faqs: [{ q: "Do I need my own insurance?", a: "For very valuable items, check whether you need your own insurance for their full value before you book." }],
  },
  "what-to-do-if-your-car-breaks-down": {
    sections: [
      { h: "Breaking down on a smart motorway", p: ["If there's no hard shoulder, try to reach an emergency area, marked with orange surfacing and an SOS sign, or leave at the next junction. If you can't, move as far left as possible, switch on hazard lights and call 999 if you feel in danger. Stay in the vehicle with your seatbelt on if it isn't safe to get out."] },
    ],
    faqs: [{ q: "Should I try to fix the car myself?", a: "Never attempt repairs on a motorway. On other roads, only do so if you're completely safe and away from traffic." }],
  },
  "how-to-transport-a-non-running-car": {
    sections: [
      { h: "Common reasons a car becomes a non-runner", p: ["Flat batteries, failed starter motors, fuel problems, engine faults and accident damage are all common causes. Cars that have stood for months may also have flat tyres or brakes that have stuck. Knowing the likely cause helps drivers decide what equipment they need, even if you can't fix it yourself."] },
      { h: "Moving a project or classic car", p: ["Restoration projects and classics are often non-runners. They may have missing panels, no interior or fragile trim. Mention this in the job and ask for enclosed transport if you need extra protection. Point out jacking and tie-down points if you know them."] },
      { h: "Selling a non-runner", p: ["If you're selling, agree with the buyer who is arranging collection. Make sure the car is accessible, the keys and paperwork are ready, and someone is there to hand it over."] },
    ],
    faqs: [{ q: "Is a non-runner the same as a breakdown?", a: "Not always. A breakdown usually needs urgent recovery, while a non-runner may be parked safely and can be moved on a planned date." }],
  },
  "moving-a-static-or-touring-caravan": {
    sections: [
      { h: "Timing your move", p: ["Many holiday parks have set times or seasons for moving caravans in and out. Check these first, as they may decide your date. For touring caravans, consider the weather, as high winds can make towing unsafe. Allow time for preparing the caravan at both ends."] },
      { h: "Buying a caravan privately", p: ["If you're buying, check the caravan's condition, paperwork and that the seller has the right to sell it. Agree who will prepare it for collection, and add the seller's contact details to the job."] },
      { h: "After delivery", p: ["When the caravan arrives, check it over with the driver before they leave. For static caravans, the park usually arranges reconnecting services and levelling. For touring caravans, check the tyres, brakes and lights before you next tow it yourself."] },
    ],
    faqs: [{ q: "Can a touring caravan be moved if the brakes have seized?", a: "Describe the problem in the job. A driver with a suitable vehicle may be able to carry it rather than tow it." }],
  },
  "shipping-container-transport-guide": {
    sections: [
      { h: "New or used containers", p: ["New containers, sometimes called one-trip containers, are usually in better condition. Used containers can vary, so check doors, seals and the floor before you buy. Either way, the size and weight decide the vehicle needed."] },
      { h: "Using a container for storage", p: ["Containers make secure, weatherproof storage on farms, sites and at businesses. Place the doors where you can open them fully, and leave room around the container for access. Raising it slightly off the ground on a firm base can help keep it dry."] },
      { h: "Moving a container again later", p: ["If you might need to move the container in future, keep access to the spot clear and record its size and weight. Empty it before it's moved where possible."] },
    ],
    faqs: [{ q: "How much space do I need for delivery?", a: "Enough for the vehicle to reach the spot and manoeuvre, plus clear space around the drop point. Add photos so drivers can check." }],
  },
  "bid-jobs-vs-fixed-price-jobs": {
    sections: [
      { h: "Example: a sofa from a seller", p: ["Say you've bought a sofa from a private seller across town. If you know roughly what you'd like to pay, a Fixed Price Job lets a driver accept your price. If you're not sure, a Bid Job lets drivers send their quotes so you can compare."] },
      { h: "Example: a caravan or container", p: ["For larger or specialist jobs, such as moving a caravan or shipping container, prices can vary depending on the vehicle and equipment. A Bid Job lets approved drivers with suitable vehicles send quotes based on your exact job."] },
      { h: "Example: a breakdown", p: ["If your car has broken down, don't wait for quotes. Get to a safe place, switch on your hazard lights and call 999 if you're in danger. Then book ASAP Recovery so your job goes straight to recovery drivers nearby."] },
      { h: "Making your job attractive to drivers", p: ["Whether you choose a Bid Job or a Fixed Price Job, clear details help. Add photos, sizes, access notes and flexible times where you can."] },
    ],
    faqs: [{ q: "Can I see who's coming before the driver arrives?", a: "Yes. Once a driver accepts your job, you can see who's coming and follow them live on the map." }],
  },
  "preparing-items-for-a-courier": {
    sections: [
      { h: "Appliances and electronics", p: ["Disconnect appliances ahead of time. Defrost and dry fridges and freezers, and drain washing machines and fit transit bolts if you have them. Pack computers and televisions in their original boxes where possible, or wrap them well and mark them fragile."] },
      { h: "Items that can't be carried", p: ["Some items aren't suitable for a standard courier, such as flammable liquids, gas bottles, chemicals or anything illegal. If you're unsure, ask before you book. Remove fuel from garden machinery and empty paint tins."] },
      { h: "Sending to someone else", p: ["If you're sending items to a friend, family member or customer, add their name and phone number and tell them a driver is coming. They can meet the driver and you'll get photo proof when it's delivered."] },
    ],
    faqs: [{ q: "How should I send documents?", a: "Use a sealed envelope or document wallet, clearly addressed. For urgent papers, book a document courier or same-day courier." }],
  },
};

// Closing sections: a worked example or common mistakes, plus a short summary.
const GUIDE_SUMMARY = {
  "how-much-does-car-transport-cost": [
    { h: "Common mistakes to avoid", p: ["The most common problems come from missing details. A car described as a runner that won't start on the day may need a different vehicle. A collection from an underground car park with a low height limit may not be possible for a large transporter. Keys left with the wrong person, or a dealer who hasn't released the car, can delay the job. Check these points before you book, and update your job if anything changes."] },
    { h: "In summary", p: ["The cost of car transport depends on distance, the size and condition of the car, open or enclosed transport, access at both ends and how soon you need it moved. Give drivers accurate details, choose the booking type that suits you, and you'll get a price that reflects your exact job."] },
  ],
  "how-much-do-house-removals-cost": [
    { h: "A worked example", p: ["Imagine two moves of the same distance. In the first, a two-bedroom flat on the ground floor is moving to a house with a driveway, with everything packed and furniture dismantled. In the second, a two-bedroom flat on the third floor with no lift is moving to a street with no parking, and packing isn't finished. The second move takes much longer, needs more help and is likely to cost more, even though the distance is the same. That's why describing access and readiness matters so much."] },
    { h: "In summary", p: ["Removal costs depend on how much you're moving, the distance, access at both properties, the number of movers, the vehicle and your date. Clear details and good preparation help you get an accurate price."] },
  ],
  "house-move-checklist": [
    { h: "Common mistakes to avoid", p: ["Leaving packing until the last day is the most common problem, followed by forgetting to check parking at the new address. Other mistakes include packing keys, documents or chargers in the van, not measuring large furniture against new doorways, and forgetting the loft, shed or garage. Working through this checklist a little at a time helps you avoid all of them."] },
    { h: "In summary", p: ["Book early, clear out, pack room by room and keep essentials with you. Confirm details with your driver, check access at both ends and follow your driver live on the day."] },
  ],
  "how-to-collect-a-marketplace-or-ebay-purchase": [
    { h: "Common mistakes to avoid", p: ["Buyers sometimes book before confirming the item's size, only to find it won't fit the vehicle or their front door. Others forget to tell the seller a driver is coming, or give a collection window the seller can't make. Paying outside the platform's protection can also leave you at risk. Confirm details with the seller first, measure carefully and keep payment safe."] },
    { h: "In summary", p: ["Agree collection details with the seller, measure the item and your home, describe the job clearly and choose ASAP Transport, a Bid Job or a Fixed Price Job. You can follow the driver live and get photo proof when it arrives."] },
  ],
  "how-to-choose-a-courier-or-man-and-van": [
    { h: "In summary", p: ["Choose a courier for smaller items and a man and van for bulky items or small moves. Match the vehicle to the job, look for clear pricing, verified drivers, live tracking and photo proof of delivery, and describe your job in detail. Then pick ASAP Transport for urgent jobs, or a Bid Job or Fixed Price Job for planned ones. Taking a few minutes to describe the job properly is the simplest way to make sure the right driver and vehicle turn up."] },
  ],
  "what-to-do-if-your-car-breaks-down": [
    { h: "Be prepared before you travel", p: ["A little preparation can help if you do break down. Keep your phone charged, and carry a warm layer, water and a torch in the car. A reflective jacket is useful on any journey. Check tyres, oil, coolant and lights regularly, and plan longer trips so you know where services and junctions are."] },
    { h: "In summary", p: ["Safety comes first: get to a safe place, switch on your hazard lights and call 999 if anyone is in danger. Once you're safe, book ASAP Recovery with clear details, wait somewhere away from traffic and follow your recovery driver live."] },
  ],
  "how-to-transport-a-non-running-car": [
    { h: "Common mistakes to avoid", p: ["The most common problem is describing a car as a runner when it isn't, or not mentioning that it won't roll. Others include forgetting height limits in car parks, not having keys available, and not checking the drop-off address is open. Clear photos and an honest description solve most of these."] },
    { h: "In summary", p: ["Describe what works and what doesn't, check access for loading, prepare the car and paperwork, and plan the drop-off. Book ASAP Recovery if it's urgent, or schedule it as a Bid Job or Fixed Price Job if not."] },
  ],
  "moving-a-static-or-touring-caravan": [
    { h: "Common mistakes to avoid", p: ["The most common problems are underestimating the size or weight, not checking gate widths and overhead cables, and booking a date the park doesn't allow. With touring caravans, flat or perished tyres and seized brakes after storage often cause delays. For static caravans, not confirming who is preparing the unit can hold up the move. Checking these points early saves time on the day."] },
    { h: "Questions to ask the park or site", p: ["Before you book, ask the park or site:"], list: ["When are caravans allowed to be moved in or out?", "Who disconnects services and removes skirting?", "Is there a site contact for the day?", "Are there any vehicle size limits on site roads?"] },
    { h: "In summary", p: ["Know your caravan's size and weight, check it's ready to move, plan access at both sites and follow park rules. Post your job with full details and photos, and approved drivers with suitable vehicles can quote."] },
  ],
  "shipping-container-transport-guide": [
    { h: "Common mistakes to avoid", p: ["The most common problems are soft ground, overhead cables near the drop spot and not enough room for the vehicle to manoeuvre. Others include forgetting the doors need space to open, not confirming the exact container size, and not telling drivers the container is loaded. Photos of the site and accurate details avoid most of these."] },
    { h: "Questions to ask before buying", p: ["If you're buying a container, ask the seller:"], list: ["What size and height is it?", "Is it wind and watertight?", "Can it be loaded at the depot or site?", "Are there any collection times or access limits?"] },
    { h: "In summary", p: ["Check the size and weight, plan how it will be unloaded, prepare a firm and level site and post your job with photos. Approved drivers with suitable vehicles can then send quotes."] },
  ],
  "bid-jobs-vs-fixed-price-jobs": [
    { h: "Quick comparison", p: ["Here's a simple way to decide:"], list: ["Want to compare offers? Choose a Bid Job.", "Know what you want to pay? Choose a Fixed Price Job.", "Need it moved now? Choose ASAP Transport.", "Broken down? Get safe, then choose ASAP Recovery."] },
    { h: "In summary", p: ["Bid Jobs let drivers send quotes so you can compare. Fixed Price Jobs let you set the price and a driver accepts it. Both suit planned jobs, while ASAP Transport and ASAP Recovery are for jobs that need doing now. Whichever you choose, clear details, photos and accurate sizes make your job easier for drivers to quote or accept."] },
  ],
  "preparing-items-for-a-courier": [
    { h: "Common mistakes to avoid", p: ["The most common problems are underestimating sizes, using weak or oversized boxes and forgetting to mention stairs or parking. Others include leaving items unpacked when the driver arrives and not telling the recipient a delivery is on the way. A quick check through this guide before booking avoids most of them."] },
    { h: "A quick checklist", p: ["Before the driver arrives:"], list: ["Everything packed, sealed and labelled", "Fragile items wrapped and marked", "Sizes and weights added to the job", "Access and parking notes up to date", "Someone ready at pickup and drop-off"] },
    { h: "In summary", p: ["Pack items securely, measure and weigh them, label clearly and describe access at both ends. Then choose ASAP Transport, a Bid Job or a Fixed Price Job and follow your driver live."] },
  ],
};

// Final extra section and FAQ per guide.
const GUIDE_FINAL = {
  "how-much-does-furniture-delivery-cost": [{ h: "Delivering to someone else", p: ["If the furniture is a gift or going to a family member, add their name and phone number to the job and let them know a driver is coming. Make sure they know where the item should go in the home and whether they need to help carry. You can still follow the driver live and get photo proof when it's delivered, even if you're not there yourself."] }, { q: "Can I add a second item after booking?", a: "Update your job with the new item and its size before the driver accepts, so they can check it fits." }],
  "how-much-does-car-transport-cost": [{ h: "Moving more than one vehicle", p: ["If you need two or more cars moved, say so in a single job or post separate jobs for each one. Some transporters can carry more than one car, which may suit dealers or people moving home with two vehicles. Give the details for each car, including whether it runs, so drivers can check what they can carry."] }, { q: "Do you move vans and motorbikes too?", a: "Yes. See our van transport and motorbike transport pages, or describe the vehicle when you book." }],
  "how-much-do-house-removals-cost": [{ h: "Moving white goods and heavy items", p: ["Washing machines, fridges, freezers, pianos and gym equipment are heavy and awkward. Disconnect appliances ahead of time, drain washing machines and defrost freezers. Tell drivers about any very heavy items so they can bring enough help and suitable equipment, such as a van with a tail lift."] }, { q: "Can I move on the same day I book?", a: "For small moves, ASAP Transport sends your job to nearby drivers who are online. Larger moves are best booked ahead." }],
  "house-move-checklist": [{ h: "Useful things to have on the day", p: ["A few small items make moving day easier: a roll of tape, scissors, a marker pen, bin bags, cleaning cloths, a basic toolkit, light bulbs, phone chargers and plenty of water and snacks. Keep them together in a clearly labelled bag or box that travels with you, not in the van."] }, { q: "Should I clean before I leave?", a: "Yes, especially if you're renting. Leave cleaning products and cloths out until last so you can do a final clean once the van is loaded." }],
  "how-to-collect-a-marketplace-or-ebay-purchase": [{ h: "Booking a collection from further away", p: ["Sometimes the best deal is in another town or city. Longer collections are still simple to book, but think about timing. A flexible date gives drivers more chance to fit your job in, and a Bid Job lets you compare quotes for longer journeys. Check the seller is happy to hold the item until the collection date."] }, { q: "What if the seller cancels?", a: "Contact the driver as soon as you can through the app and update or cancel the job." }],
  "how-to-choose-a-courier-or-man-and-van": [{ h: "Same-day and urgent jobs", p: ["When something needs moving today, speed matters. ASAP Transport sends your job to nearby drivers who are online, and you see when one accepts. Describe the job clearly so the first driver to accept has the right vehicle. For broken-down vehicles, ASAP Recovery works the same way with recovery drivers."] }, { q: "Can I message the driver?", a: "Once a driver accepts, you can keep in touch through the app and follow them live on the map." }, { q: "What if my job is unusual?", a: "Post it as a Bid Job with full details and photos, and approved drivers with suitable vehicles can send quotes." }],
  "what-to-do-if-your-car-breaks-down": [{ h: "After a collision", p: ["If you've been in a collision, check everyone is safe and call 999 if anyone is injured or the road is blocked. Exchange details with other drivers involved. Once the police or emergency services have done what they need to and it's safe, you can arrange recovery of your vehicle."] }, { q: "What details should I give when I book recovery?", a: "Your exact location, the vehicle's make and model, what's wrong, whether it rolls and steers, and where you want it taken." }],
  "how-to-transport-a-non-running-car": [{ h: "Taking a car to a garage", p: ["If the car is going for repair, call the garage first to check they can accept it and when. Tell them it's arriving on a recovery vehicle and agree where it should be left and what happens with the keys. Add the garage's contact details to your job."] }, { q: "Can a non-runner be delivered to my driveway?", a: "Yes, if there's space for the vehicle to unload. Add access notes and photos of the driveway." }],
  "moving-a-static-or-touring-caravan": [{ h: "Insurance and paperwork", p: ["Check your own caravan insurance before the move, and keep any paperwork, such as purchase documents or park agreements, with you. For static caravans, the park may need confirmation of the move date and the vehicle coming onto site. Having this ready avoids delays at the gate."] }, { q: "Do you move trailer tents and folding campers?", a: "Yes. Choose caravan transport and describe the trailer, its size and how it hitches." }, { q: "Can a static caravan be moved onto private land?", a: "Often, if there's suitable access and any permissions you need are in place. Contact us first for very large units." }],
  "shipping-container-transport-guide": [{ h: "Containers on building sites", p: ["Building sites often use containers for tool storage and welfare. Sites usually have delivery booking times, a banksman to guide vehicles and rules about where vehicles can go. Add the site manager's contact details and the delivery booking reference to your job so the driver can get on and off site safely."] }, { q: "Can you collect a container from a port?", a: "Add the collection details, release reference and terminal rules, and drivers with suitable vehicles can check whether they can take the job." }, { q: "Can you move site offices and welfare units?", a: "Yes. Describe the unit, its size and weight, and how it will be lifted." }],
  "bid-jobs-vs-fixed-price-jobs": [{ h: "Using both for a business", p: ["Businesses often use both. Fixed Price Jobs work well for regular runs where you know the price you want to pay. Bid Jobs work well for one-off or larger jobs, such as moving stock between sites or delivering equipment to an event. ASAP Transport is there for urgent deliveries that can't wait."] }, { q: "Are drivers checked for both booking types?", a: "Yes. Drivers are checked before they can take any jobs, whichever booking type you choose." }, { q: "Can I post a Bid Job for a specialist load?", a: "Yes. Approved drivers with suitable vehicles can send quotes. Add full details and photos." }],
  "preparing-items-for-a-courier": [{ h: "Preparing large furniture", p: ["Empty drawers and cupboards before the driver arrives, as full furniture is heavier and can break. Remove glass shelves and pack them separately. Tape doors and drawers closed with low-tack tape, and wrap furniture in blankets to protect corners. Keep fixings from dismantled items in a labelled bag."] }, { q: "Can a driver collect from one place and deliver to several?", a: "Yes. Add each drop-off as a stop and label items with the address they're going to." }, { q: "Do I need to be at the pickup?", a: "Someone should be there to hand over the items. Add their contact details if it isn't you." }],
};

const GUIDE_LAST_FAQS = {
  "bid-jobs-vs-fixed-price-jobs": [{ q: "Which booking type is quickest to arrange?", a: "For jobs that need doing now, ASAP Transport is quickest because it goes straight to nearby drivers who are online. For planned jobs, a clear Fixed Price Job is simple for drivers to accept." }],
  "how-to-choose-a-courier-or-man-and-van": [{ q: "Should I choose the cheapest quote?", a: "Price matters, but so does the right vehicle, clear details of what's included and a verified driver. Read each quote carefully before you choose." }, { q: "Can a man and van help with a small office move?", a: "Yes, for smaller office moves. For larger moves with lots of furniture and IT equipment, see office removals." }],
  "how-to-collect-a-marketplace-or-ebay-purchase": [{ q: "Can the driver bring the item into my home?", a: "Say where the item needs to go, including floors and stairs, and whether you need help carrying. Drivers see this before they accept." }, { q: "What if the item is fragile?", a: "Mark the job as fragile, describe the item and ask the seller to wrap it if possible." }],
  "how-to-transport-a-non-running-car": [{ q: "Can a car with flat tyres be moved?", a: "Usually yes, but say so in the job. Drivers may need skates or extra equipment to load it." }, { q: "Can you take a non-runner to a scrapyard?", a: "Yes. Add the scrapyard's address and opening hours, and use an authorised treatment facility." }, { q: "Do I need to be there at collection?", a: "Someone should hand over the keys and confirm the car. Add their contact details if it isn't you." }],
  "moving-a-static-or-touring-caravan": [{ q: "Can you tow a caravan to a workshop for a service?", a: "Yes. Add the workshop's address and opening times, and any booking reference they've given you." }, { q: "What if the caravan hasn't moved for years?", a: "Check the tyres, brakes and hitch, and describe their condition. A driver may need to carry it rather than tow it." }, { q: "Can the move be booked for a weekend?", a: "Pick the date that suits you and the park. Some parks have rules about weekend moves, so check first." }],
  "preparing-items-for-a-courier": [{ q: "How should I pack a television?", a: "Use the original box if you have it. Otherwise, wrap the screen in a blanket, protect the corners and keep it upright." }, { q: "Can I send a single box?", a: "Yes. See our parcel delivery and same-day courier pages for smaller items." }, { q: "What if I can't lift heavy boxes?", a: "Say so in the job and ask for help carrying, so drivers can plan for it." }],
  "shipping-container-transport-guide": [{ q: "Can a container be placed next to a building?", a: "Often yes, if there's room for the crane and no overhead obstacles. Add photos so drivers can check." }, { q: "Can you deliver to a business park?", a: "Yes. Add site rules, delivery times and a site contact." }, { q: "How do I describe the drop spot?", a: "Add photos, the ground surface, the distance from the road and anything overhead such as cables or trees." }],
  "what-to-do-if-your-car-breaks-down": [{ q: "Is it safe to stay in my car?", a: "Usually it's safer to get out and stand behind a barrier, away from traffic. If you can't get out safely, stay in with your seatbelt on and hazard lights on, and call 999." }],
};

export const GUIDES = GUIDES_BASE.map((g) => {
  const [extraSection, ...extraFaqs] = GUIDE_FINAL[g.slug];
  return { ...g, sections: [...g.sections, ...GUIDE_MORE[g.slug].sections, extraSection, ...(GUIDE_SUMMARY[g.slug] || [])], faqs: [...g.faqs, ...GUIDE_MORE[g.slug].faqs, ...extraFaqs, ...(GUIDE_LAST_FAQS[g.slug] || [])] };
});

export const GUIDE_BY_SLUG = Object.fromEntries(GUIDES.map((g) => [g.slug, g]));

export const GUIDES_INDEX_SEO = {
  path: "/guides",
  title: "Moving and Delivery Guides | Cargo One",
  h1: "Moving and delivery guides",
  intro: "Practical guides to help you plan moves, deliveries and vehicle recovery, from what affects the cost to how to prepare on the day.",
  description: "Practical guides on moving home, furniture delivery, car transport, breakdowns and preparing items for a courier, plus how Cargo One booking types work.",
};

export const GUIDES_INDEX_FAQS = [
  { q: "Do these guides include prices?", a: "No. Every job is different, so the guides explain what affects the cost. Enter your job details to see a price for your exact job." },
  { q: "Which booking types can I use?", a: "ASAP Transport, ASAP Recovery, Bid Jobs and Fixed Price Jobs. The Bid Jobs vs Fixed Price Jobs guide explains which to choose." },
  { q: "I've broken down. What should I do first?", a: "Get to a safe place and switch on your hazard lights. If anyone is in danger, call 999. Then you can book ASAP Recovery 24/7." },
];

export function guideSeo(g) {
  return { path: `/guides/${g.slug}`, title: g.title, h1: g.h1, intro: g.intro, description: g.description };
}

export function guideJsonLd(g, image) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.h1,
      description: g.description,
      image: image.startsWith("http") ? image : `${SITE_URL}${image}`,
      author: { "@type": "Organization", name: "Cargo One", url: SITE_URL },
      publisher: { "@type": "Organization", name: "Cargo One", url: SITE_URL },
      mainEntityOfPage: `${SITE_URL}/guides/${g.slug}`,
    },
    faqJsonLd(g.faqs),
    breadcrumbJsonLd([["Home", "/"], ["Guides", "/guides"], [g.h1, `/guides/${g.slug}`]]),
  ];
}

export function guidesIndexJsonLd() {
  return [faqJsonLd(GUIDES_INDEX_FAQS), breadcrumbJsonLd([["Home", "/"], ["Guides", "/guides"]])];
}

// ---------- SEO Phase 4 helpers ----------
// Nearby towns that already have their own hub are linked to it (no cannibalisation).
const HUB_SLUG_BY_NAME = Object.fromEntries([...LOCAL_CITIES, ...LOCAL_PLACES].map((p) => [p.name, p.slug]));

export function placeNearbyTowns(c) {
  return c.nearbyTowns.towns.map((name) => ({ name, slug: HUB_SLUG_BY_NAME[name] }));
}

// ---------- SEO: ASAP live dispatch hub (/asap, /asap/live-tracking, /asap/recovery, /asap/recovery/{city}) ----------
// Facts only from the existing ASAP pages and the app. No prices, times, counts, ratings or brand comparisons.
const ASAP_PAY = "Pay Cargo One's booking fee by card. The driver's price is paid to the driver on delivery.";
const ASAP_CANCEL = "While your job is still waiting for a driver, you can cancel it in the app and your booking fee is refunded in full. Once the vehicle or items have been collected, the job can't be cancelled in the app, so contact support.";
const ASAP_MOTORWAY = "If the vehicle is on a live motorway, it should first be moved by the official services. Once it is somewhere safe, such as a recovery yard, you can book ASAP Recovery from there.";
const ASAP_SAFETY = ["Get yourself and any passengers to a safe place, away from moving traffic", "Switch on your hazard lights", "If anyone is in danger, call 999", "On a live motorway, the official services move the vehicle first; book recovery once it is in a safe place"];
const ASAP_APP_LINKS = [["Download on the App Store", "https://apps.apple.com/app/cargo-one"], ["Get it on Google Play", "https://play.google.com/store/apps/details?id=com.cargoone.app"]];
const ASAP_IMG = { van: "/images/van-road-hero.webp", recovery: "/images/recovery-truck-hero.webp", boxes: "/images/how-it-works-hero-boxes.webp" };
const ASAP_CRUMB = ["ASAP", "/asap"];
const ASAP_RECOVERY_CRUMB = ["ASAP Recovery", "/asap/recovery"];

const ASAP_HUB = {
  path: "/asap", kind: "Service", eyebrow: "ASAP · LIVE DISPATCH", image: ASAP_IMG.van,
  title: "On-Demand Courier & Recovery, Booked Live 24/7 | Cargo One",
  h1: "On-demand courier and recovery, booked live 24/7",
  description: "How Cargo One's ASAP live dispatch works: book a courier or vehicle recovery 24/7, see an instant price and track a nearby driver live on the map.",
  intro: "ASAP is Cargo One's on-demand, app-based way to book. Instead of posting a job and waiting for offers, you get an instant price, pay the booking fee and your job is sent straight to available drivers near the pickup. You can book 24/7, 365 days a year, with drivers available around the clock.",
  crumbs: [["Home", "/"], ["ASAP"]],
  sections: [
    { h: "What ASAP means on Cargo One", p: ["ASAP stands for \"as soon as possible\". It is live dispatch: the job is offered to drivers who are online and available at that moment, rather than booked for a later date. There are two ASAP booking types.", "ASAP Transport is for moving things now, from a single parcel or a marketplace collection to a van load. ASAP Recovery is for vehicles that need moving now, such as breakdowns, non-runners and accident-damaged vehicles. Both work in the same live way, and neither comes with a guaranteed arrival or response time, because it depends on which drivers are available near you when you book."] },
    { h: "How live dispatch works, step by step", p: ["Every ASAP booking follows the same flow, whether you're moving a sofa or recovering a car."], list: [
      "Enter the details: pickup, drop-off and what's being moved. For recovery, add where the vehicle is, where it's going, whether it runs, whether you have the keys and whether the wheels turn.",
      "Choose a vehicle and see an instant price straight away.",
      `Pay the booking fee: ${ASAP_PAY}`,
      "Nearby drivers are alerted: available drivers near the pickup with a suitable vehicle are alerted first, and the search widens if needed.",
      "A driver is assigned: the first suitable driver to accept is assigned to your job.",
      "Track it live: follow the driver on the map from acceptance, through collection, to drop-off.",
      "Get photo proof: the driver uploads photo proof when the job is done and you get a notification.",
    ] },
    { h: "What you see in the app", p: ["The app keeps you informed at each stage, so you're not left wondering whether anyone is coming."], list: [
      "An instant price as soon as you've entered the job and chosen a vehicle",
      "A clear waiting state while nearby drivers are being alerted",
      "The moment a driver accepts, and who is coming",
      "A live map showing the driver from acceptance, through collection, to drop-off",
      "Photo proof when the job is done, with a notification to let you know",
    ] },
    { h: "ASAP Transport vs ASAP Recovery", p: ["ASAP Transport covers goods and items: same-day deliveries, urgent collections, last-minute marketplace pickups and business jobs that can't wait until tomorrow. You choose a vehicle that suits the load.", "ASAP Recovery covers vehicles. You tell us about the vehicle and its condition, choose a suitable recovery vehicle and the job goes to recovery drivers near you. Recovery drivers use vehicles such as tow trucks, flatbeds and low-loaders, depending on the vehicle being moved."] },
    { h: "Safety first", p: ["If you've broken down, your safety comes before booking anything."], list: ASAP_SAFETY },
    { h: "Cancelling while you wait", p: [ASAP_CANCEL] },
  ],
  table: {
    h: "ASAP vs Bid Jobs vs Fixed Price Jobs",
    head: ["", "ASAP Transport / ASAP Recovery", "Bid Jobs", "Fixed Price Jobs"],
    rows: [
      ["When", "Now, 24/7", "A date you choose", "A date you choose"],
      ["Price", "Instant price shown when you book", "Drivers send you their offers", "You set the price, with a suggested price as a guide"],
      ["How a driver is found", "Nearby available drivers are alerted; the first suitable driver to accept is assigned", "You compare offers and accept the one you want", "The first suitable driver to accept takes the job"],
      ["Best for", "Urgent jobs, breakdowns and non-runners", "Planned moves where you want to compare offers", "Routine jobs where you know the going rate"],
      ["Payment", ASAP_PAY, ASAP_PAY, ASAP_PAY],
    ],
  },
  faqs: [
    { q: "Can I get a man and van right now?", a: "Yes. Book ASAP Transport, enter your pickup, drop-off and what you're moving, and choose a van that suits the load. You see an instant price, and once you've paid the booking fee the job goes straight to available drivers nearby. Arrival times aren't guaranteed, as they depend on which drivers are available at that moment." },
    { q: "Is there an app to book a courier on demand in the UK?", a: "Yes. The Cargo One app lets you book ASAP Transport and ASAP Recovery 24/7 across the UK. You get an instant price, your job is sent to nearby drivers, and you can track the driver live on the map." },
    { q: "How do I track my courier live?", a: "Once a driver accepts your ASAP job, you can follow them on the map in the app, from acceptance, through collection, to drop-off. When the job is done, the driver uploads photo proof and you get a notification." },
    { q: "Can I book vehicle recovery at night?", a: "Yes. ASAP Recovery can be booked 24/7, 365 days a year, including nights, weekends and bank holidays. The job is offered to recovery drivers who are online when you book." },
    { q: "How is a driver chosen for an ASAP job?", a: "Available drivers near the pickup with a suitable vehicle are alerted first. If needed, the search widens to drivers further away. The first suitable driver to accept is assigned to your job." },
    { q: "How do I pay for an ASAP booking?", a: ASAP_PAY },
    { q: "Can I cancel an ASAP booking?", a: ASAP_CANCEL },
    { q: "Is there a guaranteed arrival time?", a: "No. ASAP jobs go to drivers who are available near you when you book, so there's no guaranteed arrival or response time. You can follow the driver live on the map once they accept." },
    { q: "When should I use a Bid Job or Fixed Price Job instead?", a: "If the job can wait for a set date, a Bid Job lets you compare offers from drivers, and a Fixed Price Job lets you set the price up front. ASAP is for when you need it done now." },
    { q: "My car has broken down on the motorway. Can I book recovery?", a: ASAP_MOTORWAY },
  ],
  links: [
    ["How ASAP Transport works", "/how-it-works/asap-transport"], ["How ASAP Recovery works", "/how-it-works/asap-recovery"],
    ["How live tracking works", "/asap/live-tracking"], ["24/7 ASAP vehicle recovery", "/asap/recovery"],
    ["Same Day Courier", "/services/same-day-courier"], ["Vehicle Recovery", "/services/vehicle-recovery"],
    ["Non-Runner Car Transport", "/services/non-runner-car-transport"], ["What to do if your car breaks down", "/guides/what-to-do-if-your-car-breaks-down"],
    ["Bid Jobs", "/how-it-works/bid-jobs"], ["Fixed Price Jobs", "/how-it-works/fixed-price-jobs"],
  ],
  appLinks: true,
};

const ASAP_TRACKING = {
  path: "/asap/live-tracking", kind: "Article", eyebrow: "ASAP · LIVE TRACKING", image: ASAP_IMG.boxes,
  title: "Live Courier & Recovery Tracking Explained | Cargo One",
  h1: "How live courier and recovery tracking works",
  description: "What you see when you track an ASAP Transport or ASAP Recovery job live: driver accepted, on the way, collected, delivered and photo proof.",
  intro: "When you book ASAP Transport or ASAP Recovery, you don't have to wonder where your driver is. From the moment a driver accepts your job, you can follow them on the map in the Cargo One app, through collection and on to drop-off, with photo proof when the job is done.",
  crumbs: [["Home", "/"], ASAP_CRUMB, ["Live tracking"]],
  sections: [
    { h: "Before a driver accepts", p: ["After you've paid the booking fee, your job is sent to available drivers near the pickup with a suitable vehicle. The search widens if needed. While you're waiting for a driver, the app shows that drivers are being alerted.", "If your plans change while you're still waiting for a driver, you can cancel in the app and your booking fee is refunded in full."] },
    { h: "Driver accepted", p: ["The first suitable driver to accept is assigned to your job, and you can see who's coming. From this point the driver appears on the live map."] },
    { h: "On the way to the pickup", p: ["You can watch the driver head towards the pickup on the map. If you're waiting with a broken-down vehicle, make sure you're somewhere safe while you wait. For recovery jobs, the details you added about the vehicle, the keys and access help the driver when they arrive."] },
    { h: "Collected and on to the drop-off", p: ["Once your items or vehicle have been collected, the map follows the driver to the drop-off. After collection, the job can't be cancelled in the app, so contact support if something changes."] },
    { h: "Delivered, with photo proof", p: ["When the job is done, the driver uploads photo proof and you get a notification. The photos give you a record of how and where your items or vehicle were left."] },
    { h: "The stages at a glance", p: ["Every ASAP job moves through the same stages, so you always know where things stand."], list: ["Waiting for a driver: nearby drivers are being alerted", "Accepted: a driver has taken the job and appears on the map", "On the way: the driver is heading to the pickup", "Collected: your items or vehicle are on board", "Delivered: photo proof is uploaded and you're notified"] },
  ],
  faqs: [
    { q: "When does live tracking start?", a: "Live tracking starts when a driver accepts your ASAP job. You can then follow them on the map from acceptance, through collection, to drop-off." },
    { q: "Can I track a recovery truck live?", a: "Yes. ASAP Recovery jobs are tracked in the same way as ASAP Transport, so you can follow the recovery driver on the map from acceptance to drop-off." },
    { q: "Will I know when my delivery is complete?", a: "Yes. When the job is done, the driver uploads photo proof and you get a notification." },
    { q: "Do I need the app to track my driver?", a: "Live tracking is shown on the map in the Cargo One app once a driver accepts your job." },
    { q: "What if no driver has accepted yet?", a: "While your job is still waiting for a driver, you can cancel it in the app and your booking fee is refunded in full." },
  ],
  links: [
    ["ASAP live dispatch explained", "/asap"], ["24/7 ASAP vehicle recovery", "/asap/recovery"],
    ["How ASAP Transport works", "/how-it-works/asap-transport"], ["How ASAP Recovery works", "/how-it-works/asap-recovery"],
    ["Same Day Courier", "/services/same-day-courier"], ["Vehicle Recovery", "/services/vehicle-recovery"],
  ],
  appLinks: true,
};

const ASAP_RECOVERY = {
  path: "/asap/recovery", kind: "Service", serviceType: "Vehicle recovery", eyebrow: "ASAP RECOVERY · 24/7", image: ASAP_IMG.recovery,
  title: "24/7 ASAP Vehicle Recovery: How It Works | Cargo One",
  h1: "24/7 ASAP vehicle recovery: how it works",
  description: "An in-depth look at ASAP Recovery: what to do first after a breakdown, what details to give, the recovery vehicles used and how live tracking works.",
  intro: "A breakdown rarely happens at a convenient time. ASAP Recovery lets you book vehicle recovery live, 24/7, 365 days a year, from the Cargo One app or website. This page goes through the whole process in detail: staying safe, what to tell the driver, which recovery vehicles are used and what happens once your job is sent out.",
  crumbs: [["Home", "/"], ASAP_CRUMB, ["ASAP Recovery"]],
  sections: [
    { h: "When to use ASAP Recovery", p: ["ASAP Recovery is for any vehicle that needs moving now and can't, or shouldn't, be driven. That includes:"], list: ["Breakdowns at home, at work, in a car park or by the roadside", "Non-runners that need taking to a garage, a home or a yard", "Accident-damaged vehicles that can't be driven safely", "Cars, vans, motorbikes and heavier vehicles"] },
    { h: "Stay safe before you book", p: ["Booking a recovery comes second to keeping everyone safe. Before you open the app:"], list: ASAP_SAFETY },
    { h: "The motorway rule", p: [ASAP_MOTORWAY, "This applies to any live motorway, at any time of day. Booking from a safe place keeps you, the recovery driver and other road users out of danger."] },
    { h: "What to tell the driver", p: ["The more accurate your details, the easier it is for a suitable driver to accept and to recover the vehicle first time. When you book, you add:"], list: ["The exact location of the vehicle, such as the street, car park level or a nearby landmark", "Where the vehicle is going", "Whether the vehicle runs", "Whether you have the keys", "Whether the wheels turn, or if any are locked or damaged", "How to access the vehicle, especially if you can't stay with it"] },
    { h: "Recovery vehicles drivers use", p: ["You choose a suitable recovery vehicle when you book. In general terms, recovery drivers use:"], list: ["Tow trucks, which lift one end of the vehicle and tow it on its other wheels", "Flatbeds, including tilt-and-slide beds, which carry the whole vehicle on a bed that tilts down to load it", "Low-loaders, with a low deck for low, long or heavy vehicles"] },
    { h: "What happens after you book", p: [`You see an instant price once you've chosen a recovery vehicle. ${ASAP_PAY}`, "Recovery drivers near the vehicle with a suitable vehicle are alerted first, and the search widens if needed. The first suitable driver to accept is assigned, and there is no guaranteed arrival or response time."] },
    { h: "Live tracking and photo proof", p: ["Once a driver accepts, you can follow the recovery on the map from acceptance, through collection, to drop-off. When the vehicle is dropped off, the driver uploads photo proof and you get a notification."] },
    { h: "Cancelling", p: [ASAP_CANCEL] },
  ],
  faqs: [
    { q: "Can I get my car recovered right now?", a: "You can book ASAP Recovery 24/7. Your job is sent straight to recovery drivers who are online near the vehicle, and the first suitable driver to accept is assigned. There's no guaranteed arrival time." },
    { q: "My car won't start. Is that a recovery job?", a: "Yes. Non-runners are one of the most common ASAP Recovery jobs. Say that the vehicle doesn't run, whether you have the keys and whether the wheels turn, so a suitable recovery vehicle is used." },
    { q: "Can you recover an accident-damaged car?", a: "Yes, as long as it is somewhere safe. If the vehicle is on a live motorway, the official services move it first, and you can then book recovery from a safe place." },
    { q: "Do I need to stay with the vehicle?", a: "Stay with it if it's safe to do so. If you have to leave, give the precise location, explain how the driver can get to the vehicle and say where the keys will be." },
    { q: "Can I book a recovery at night or at the weekend?", a: "Yes. ASAP Recovery can be booked 24/7, 365 days a year, and the job is offered to recovery drivers online near the vehicle when you book." },
    { q: "How do I pay for ASAP Recovery?", a: ASAP_PAY },
  ],
  links: [
    ["How ASAP Recovery works", "/how-it-works/asap-recovery"], ["ASAP live dispatch explained", "/asap"], ["How live tracking works", "/asap/live-tracking"],
    ["Vehicle Recovery", "/services/vehicle-recovery"], ["Non-Runner Car Transport", "/services/non-runner-car-transport"],
    ["What to do if your car breaks down", "/guides/what-to-do-if-your-car-breaks-down"], ["How to transport a non-running car", "/guides/how-to-transport-a-non-running-car"],
  ],
  appLinks: true,
};

// City-specific copy: unique intro, road notes and FAQs per city. Areas come from the existing city data.
const ASAP_RECOVERY_CITY_DATA = [
  {
    slug: "london",
    intro: "Breaking down in London can mean anything from a car that won't start on a residential street in Clapham to a van stuck on the North Circular at rush hour. With ASAP Recovery you can book live from your phone, day or night, and follow the recovery driver across the city on the map.",
    roads: [
      ["M25", "The orbital motorway around London. If you stop on the M25, the official services move the vehicle first; book recovery once it is somewhere safe."],
      ["A406 North Circular", "A busy dual carriageway through north London. If you break down here, get to a safe place away from traffic before booking."],
      ["A13", "The main road east towards Barking and Dagenham. Give the exact junction or nearby landmark so the driver can find you."],
      ["A40 Westway", "The elevated route into west London. If the vehicle can't be moved to a safe spot, put your safety first and call 999 if anyone is in danger."],
    ],
    faqs: [
      { q: "Can I book ASAP Recovery from a London car park?", a: "Yes. Add the car park name, the level and where the vehicle is parked, plus any height limits at the entrance, so the driver can plan the right recovery vehicle." },
      { q: "I've broken down on the M25. What should I do?", a: "The M25 is a live motorway, so the official services move the vehicle first. Once it is somewhere safe, you can book ASAP Recovery from there and track the driver live." },
      { q: "Can I track the recovery truck through London traffic?", a: "Yes. Once a driver accepts, you can follow them on the map from acceptance, through collection, to drop-off anywhere in London." },
    ],
  },
  {
    slug: "birmingham",
    intro: "Birmingham sits at the centre of the motorway network, so breakdowns here range from cars that won't start in Moseley or Harborne to vehicles that have been moved off the M6 near Spaghetti Junction. ASAP Recovery lets you book live, 24/7, and see the recovery driver on the map as they come to you.",
    roads: [
      ["M6 at Spaghetti Junction", "One of the busiest motorway junctions in the country. If you stop on the M6, the official services move the vehicle first; then book recovery from a safe place."],
      ["M5", "The motorway running south-west from Birmingham. The same motorway rule applies: wait for the official services if you're on the live carriageway."],
      ["M42", "Running east and south of the city past the airport and the NEC. Book once the vehicle has been moved somewhere safe."],
      ["A38(M) Aston Expressway", "A short motorway into the city centre. Motorway rules apply here too, so the official services move a stopped vehicle first."],
    ],
    faqs: [
      { q: "Can I book recovery after breaking down near Spaghetti Junction?", a: "If the vehicle is on the live motorway, the official services move it first. Once it is somewhere safe, book ASAP Recovery and follow the driver live on the map." },
      { q: "My car won't start at home in Birmingham. Can you help?", a: "Yes. Book ASAP Recovery, say the car doesn't run, whether you have the keys and whether the wheels turn, and add where it's going, such as your garage." },
      { q: "Can I book recovery in Birmingham on a Sunday night?", a: "Yes. ASAP Recovery can be booked 24/7, 365 days a year, and the job is offered to recovery drivers online near the vehicle when you book." },
    ],
  },
  {
    slug: "manchester",
    intro: "Manchester is ringed by the M60, with the M62, M56 and M602 feeding traffic in from every direction. Whether your car has given up in Didsbury, Chorlton or the Trafford Park area, ASAP Recovery lets you book live and track your recovery driver across Greater Manchester.",
    roads: [
      ["M60", "The ring motorway around Manchester. If you stop on it, the official services move the vehicle first; then you can book recovery from a safe place."],
      ["M62", "The trans-Pennine motorway to the north of the city. The motorway rule applies on the live carriageway."],
      ["M56", "Running south to the airport and towards Cheshire. Book recovery once the vehicle has been moved somewhere safe."],
      ["M602", "The short motorway link into Salford. Motorway rules apply, so wait for the official services if you've stopped on it."],
    ],
    faqs: [
      { q: "I've broken down on the M60. Can I book ASAP Recovery?", a: "Not while the vehicle is on the live motorway. The official services move it first, and once it is somewhere safe you can book ASAP Recovery from there." },
      { q: "Can I get a non-runner collected from a Manchester street?", a: "Yes. Add the exact street, whether the car runs, has keys and has wheels that turn, and how to access it if you can't stay with it." },
      { q: "Will I see when the recovery driver is close?", a: "Yes. Once a driver accepts, you can follow them on the map as they head to the vehicle in Manchester." },
    ],
  },
  {
    slug: "leeds",
    intro: "Leeds is where the M1, M62 and M621 meet, and the A64 runs out towards York. Breakdowns here can happen anywhere from Headingley's terraced streets to the industrial estates at Cross Green and Stourton. ASAP Recovery lets you book live and follow the recovery on the map.",
    roads: [
      ["M1", "Running south from Leeds. If you stop on the M1, the official services move the vehicle first; book recovery from a safe place."],
      ["M62", "The east-west motorway south of the city. The same motorway rule applies on the live carriageway."],
      ["M621", "The motorway link into the city centre. Wait for the official services if you've stopped on it."],
      ["A64", "The main road east from Leeds. If you break down on it, get to a safe place away from traffic first."],
    ],
    faqs: [
      { q: "Can I book recovery from an industrial estate in Leeds?", a: "Yes. Add the estate, the unit or a landmark, and how the driver can reach the vehicle, especially outside working hours." },
      { q: "My car broke down on the M621. What happens next?", a: "The M621 is a motorway, so the official services move the vehicle first. Once it is somewhere safe, you can book ASAP Recovery and track the driver live." },
      { q: "Can I book ASAP Recovery in Leeds late at night?", a: "Yes. ASAP Recovery runs 24/7, 365 days a year, and late-night jobs in Leeds are offered to recovery drivers who are online when you book." },
    ],
  },
  {
    slug: "glasgow",
    intro: "Glasgow's motorways, the M8, M74, M77 and M80, carry traffic right through and around the city. If your car won't go in the West End, Shawlands or Dennistoun, or has been moved off a motorway to a safe place, ASAP Recovery lets you book live and track the driver on the map.",
    roads: [
      ["M8", "The motorway through the heart of Glasgow. If you stop on it, the official services move the vehicle first; then book recovery from a safe place."],
      ["M74", "Running south-east from the city. The motorway rule applies on the live carriageway."],
      ["M77", "Heading south-west towards Ayrshire. Book recovery once the vehicle is somewhere safe."],
      ["M80", "Running north-east towards Stirling. Wait for the official services if you've stopped on it."],
    ],
    faqs: [
      { q: "I've broken down on the M8 in Glasgow. Can I book recovery?", a: "The M8 is a live motorway, so the official services move the vehicle first. Once it is in a safe place, you can book ASAP Recovery from there." },
      { q: "Can you collect a car from a tenement street in Glasgow?", a: "Yes. Add the exact address, where the car is parked and any access details, plus whether it runs, has keys and has wheels that turn." },
      { q: "Can I track my recovery driver in Glasgow?", a: "Yes. Once a driver accepts, you can follow them on the map from acceptance, through collection, to drop-off." },
    ],
  },
  {
    slug: "liverpool",
    intro: "Liverpool is served by the M62, M57 and M58, with the Mersey tunnels linking the city to the Wirral. Whether your car won't start in Allerton or Wavertree or has broken down near the docks at Seaforth, ASAP Recovery lets you book live and follow the recovery on the map.",
    roads: [
      ["M62", "The main motorway east out of Liverpool. If you stop on it, the official services move the vehicle first; book recovery from a safe place."],
      ["M57", "Running along the east side of the city. The motorway rule applies on the live carriageway."],
      ["M58", "Heading north-east towards Wigan. Book recovery once the vehicle is somewhere safe."],
      ["The Mersey tunnels", "The road links under the river to the Wirral. If you have a problem here, follow the instructions you're given and book recovery once the vehicle is somewhere safe."],
    ],
    faqs: [
      { q: "Can I book recovery to take my car from Liverpool to a garage on the Wirral?", a: "Yes. Add the pickup and the garage as the drop-off, and you'll see an instant price for the recovery vehicle you choose." },
      { q: "I broke down on the M62 near Liverpool. What do I do?", a: "The M62 is a live motorway, so the official services move the vehicle first. Once it is somewhere safe, you can book ASAP Recovery from there." },
      { q: "Can I book ASAP Recovery in Liverpool on a bank holiday?", a: "Yes. ASAP Recovery can be booked 24/7, 365 days a year." },
    ],
  },
  {
    slug: "newcastle",
    intro: "Around Newcastle, the A1 Western Bypass, A19, A69 and the Tyne Tunnel carry most of the traffic. If your car has broken down in Jesmond, Gosforth or Heaton, or at the Team Valley, ASAP Recovery lets you book live, 24/7, and track the recovery driver on the map.",
    roads: [
      ["A1 Western Bypass", "The main route around the west of the city. If you break down on it, get to a safe place away from traffic before booking."],
      ["A19", "Running north to south on the east side of Tyneside. Give the nearest junction or landmark so the driver can find the vehicle."],
      ["A69", "Heading west towards Carlisle. Stay safe, switch on your hazard lights and call 999 if anyone is in danger."],
      ["The Tyne Tunnel", "The A19 crossing under the river. If you have a problem here, follow the instructions you're given and book recovery once the vehicle is somewhere safe."],
    ],
    faqs: [
      { q: "Can I book recovery from the Team Valley in Gateshead?", a: "Yes. Add the exact location, such as the unit or a nearby landmark, and how the driver can reach the vehicle." },
      { q: "My car won't start in Newcastle. Can a recovery driver take it to my garage?", a: "Yes. Say the car doesn't run, whether you have the keys and whether the wheels turn, and add your garage as the drop-off." },
      { q: "Can I follow the recovery truck live in Newcastle?", a: "Yes. Once a driver accepts, you can follow them on the map from acceptance, through collection, to drop-off." },
    ],
  },
  {
    slug: "sheffield",
    intro: "Sheffield's hills and the M1 at Tinsley Viaduct both have their share of breakdowns, from cars that won't start on steep streets in Crookes or Walkley to vehicles that have stopped on the Parkway. ASAP Recovery lets you book live and follow the recovery driver on the map.",
    roads: [
      ["M1 at Tinsley Viaduct", "The motorway past the east of the city. If you stop on the M1, the official services move the vehicle first; then book recovery from a safe place."],
      ["Sheffield Parkway", "The main route between the M1 and the city centre. If you break down here, get to a safe place away from traffic first."],
      ["A61", "Running north and south through the city. Give the nearest junction or landmark when you book."],
      ["A57 Snake Pass", "The route west over the Peak District. Add the exact spot, as there may be few landmarks nearby."],
    ],
    faqs: [
      { q: "Can you recover a car from a steep street in Sheffield?", a: "Yes. Tell us the exact address, whether the car runs and whether the wheels turn, so a suitable recovery vehicle is used." },
      { q: "I broke down on the Snake Pass. Can I book ASAP Recovery?", a: "Yes, once you're safe. Switch on your hazard lights, call 999 if anyone is in danger, and add the exact location, as there may be few landmarks nearby." },
      { q: "Can I book recovery in Sheffield at night?", a: "Yes. ASAP Recovery can be booked 24/7, 365 days a year." },
    ],
  },
  {
    slug: "bristol",
    intro: "Bristol sits beside the M4 and M5, with the M32 bringing traffic into the centre and the A4 Portway running out to Avonmouth. Whether your car won't start in Clifton or Bedminster, or has been moved off the M5 to a safe place, ASAP Recovery lets you book live and track the recovery driver.",
    roads: [
      ["M5 at the Avonmouth Bridge", "A busy motorway crossing west of the city. If you stop on it, the official services move the vehicle first; then book recovery from a safe place."],
      ["M4/M5 Almondsbury interchange", "Where the two motorways meet north of Bristol. The motorway rule applies on the live carriageway."],
      ["M32", "The motorway into the city centre. Wait for the official services if you've stopped on it."],
      ["A4 Portway", "Running alongside the river to Avonmouth. If you break down here, get to a safe place away from traffic before booking."],
    ],
    faqs: [
      { q: "I've broken down on the M32 in Bristol. Can I book recovery?", a: "The M32 is a motorway, so the official services move the vehicle first. Once it is somewhere safe, you can book ASAP Recovery and track the driver live." },
      { q: "Can I get a car recovered from Clifton's narrow streets?", a: "Yes. Add the exact address, where the car is parked and any access details, so the driver can plan how to reach it." },
      { q: "Can I book ASAP Recovery in Bristol at the weekend?", a: "Yes. Weekends are no different: ASAP Recovery can be booked 24/7, every day of the year." },
    ],
  },
  {
    slug: "nottingham",
    intro: "Nottingham is served by the M1 between junctions 24 and 27, with the A52, A610 and the A6514 Ring Road carrying traffic around the city. If your car has broken down in West Bridgford, Beeston or Sherwood, ASAP Recovery lets you book live, 24/7, and track the recovery driver.",
    roads: [
      ["M1 junctions 24 to 27", "The motorway west of the city. If you stop on the M1, the official services move the vehicle first; then book recovery from a safe place."],
      ["A52", "Running east and west through Nottingham. If you break down here, get to a safe place away from traffic first."],
      ["A610", "Heading north-west towards the M1. Give the nearest junction or landmark when you book."],
      ["The A6514 Ring Road", "The ring road around the city. Stay safe, switch on your hazard lights and call 999 if anyone is in danger."],
    ],
    faqs: [
      { q: "Can I book recovery from the Nottingham Ring Road?", a: "Yes, once you're safe. Get away from moving traffic, switch on your hazard lights, then add the nearest junction or landmark when you book." },
      { q: "My car broke down on the M1 near Nottingham. What now?", a: "The M1 is a live motorway, so the official services move the vehicle first. Once it is somewhere safe, you can book ASAP Recovery from there." },
      { q: "Will I get photo proof when my car is dropped off?", a: "Yes. When the vehicle is dropped off, the driver uploads photo proof and you get a notification." },
    ],
  },
  {
    slug: "stoke-on-trent",
    intro: "Stoke-on-Trent is linked by the A500 to junctions 15 and 16 of the M6, with the A50 and A53 heading out east and north. Whether your car won't start in Trentham or Hartshill or has broken down near the Etruria Valley, ASAP Recovery lets you book live and follow the recovery on the map.",
    roads: [
      ["A500", "The main road through the Potteries. If you break down on it, get to a safe place away from traffic before booking."],
      ["M6 junctions 15 and 16", "The motorway either side of the city. If you stop on the M6, the official services move the vehicle first; then book recovery from a safe place."],
      ["A50", "Heading east towards Derby. Give the nearest junction or landmark so the driver can find the vehicle."],
      ["A53", "Running north-east towards Leek. Add the exact spot, especially on the quieter stretches."],
    ],
    faqs: [
      { q: "Can I book recovery after breaking down on the A500?", a: "Yes, once you're safe. Get away from moving traffic, switch on your hazard lights and call 999 if anyone is in danger, then book ASAP Recovery." },
      { q: "Can a recovery driver take my car from Stoke to a garage in Newcastle-under-Lyme?", a: "Yes. Add the garage as the drop-off and you'll see an instant price for the recovery vehicle you choose." },
      { q: "Can I book ASAP Recovery in Stoke-on-Trent at night?", a: "Yes. ASAP Recovery can be booked 24/7, 365 days a year." },
    ],
  },
  {
    slug: "preston",
    intro: "Preston sits on the M6, with the M55 heading to Blackpool, the M61 to Manchester and the A59 running east and west. If your car won't start in Fulwood or Penwortham, or has broken down near Preston Docks, ASAP Recovery lets you book live and track the recovery driver on the map.",
    roads: [
      ["M6", "The main north-south motorway past Preston. If you stop on it, the official services move the vehicle first; then book recovery from a safe place."],
      ["M55", "The motorway west towards Blackpool. The motorway rule applies on the live carriageway."],
      ["M61", "Heading south towards Bolton and Manchester. Book recovery once the vehicle is somewhere safe."],
      ["A59", "Running through the city towards Liverpool and Skipton. If you break down here, get to a safe place away from traffic first."],
    ],
    faqs: [
      { q: "I've broken down on the M55 near Preston. Can I book recovery?", a: "The M55 is a live motorway, so the official services move the vehicle first. Once it is somewhere safe, you can book ASAP Recovery from there." },
      { q: "Can you collect a non-runner from Preston Docks?", a: "Yes. Add the exact location and access details, plus whether the vehicle runs, has keys and has wheels that turn." },
      { q: "Can I follow my recovery driver live in Preston?", a: "Yes. Once a driver accepts, you can follow them on the map from acceptance, through collection, to drop-off." },
    ],
  },
];

function asapCityPage(d) {
  const c = LOCAL_CITY_BY_SLUG[d.slug] || LOCAL_PLACE_BY_SLUG[d.slug];
  return {
    path: `/asap/recovery/${d.slug}`, kind: "Service", serviceType: "Vehicle recovery", city: c.name, eyebrow: `ASAP RECOVERY · ${c.name.toUpperCase()}`, image: ASAP_IMG.recovery,
    title: `ASAP Recovery ${c.name}: Book & Track Live | Cargo One`,
    h1: `ASAP Recovery in ${c.name}, booked and tracked live`,
    description: `Broken down in ${c.name}? Book ASAP Recovery live 24/7, see an instant price and track your recovery driver on the map until drop-off.`,
    intro: d.intro,
    crumbs: [["Home", "/"], ASAP_CRUMB, ASAP_RECOVERY_CRUMB, [c.name]],
    sections: [
      { h: `Main roads around ${c.name}`, p: [`These are some of the main roads around ${c.name}. The safety steps are the same wherever you are: get to a safe place, switch on your hazard lights and call 999 if anyone is in danger.`], list: d.roads.map(([r, t]) => `${r}: ${t}`) },
      { h: `Booking ASAP Recovery in ${c.name} now`, p: [`Add where the vehicle is in ${c.name}, where it's going, whether it runs, whether you have the keys and whether the wheels turn, then choose a recovery vehicle to see an instant price. ${ASAP_PAY}`, "Recovery drivers near the vehicle are alerted first, and the search widens if needed. The first suitable driver to accept is assigned. There's no guaranteed arrival time, as it depends on which drivers are online at that moment."] },
      { h: "Tracking your recovery live", p: ["Once a driver accepts, you can follow the recovery on the map from acceptance, through collection, to drop-off. When the vehicle is dropped off, the driver uploads photo proof and you get a notification. While you're still waiting for a driver, you can cancel in the app and your booking fee is refunded in full."] },
      { h: `Areas we cover in ${c.name}`, p: [`ASAP Recovery can be booked from anywhere in ${c.name}, including residential streets and industrial areas such as:`], list: [...c.residential, ...c.industrial] },
    ],
    faqs: d.faqs,
    links: [
      [`Vehicle Recovery in ${c.name}`, `/services/vehicle-recovery/${d.slug}`], [`Couriers in ${c.name}`, `/couriers/${d.slug}`],
      ["24/7 ASAP vehicle recovery", "/asap/recovery"], ["How ASAP Recovery works", "/how-it-works/asap-recovery"], ["How live tracking works", "/asap/live-tracking"],
    ],
    otherCities: true,
  };
}

export const ASAP_RECOVERY_CITIES = ASAP_RECOVERY_CITY_DATA.map(asapCityPage);
export const ASAP_PAGES = [ASAP_HUB, ASAP_TRACKING, ASAP_RECOVERY, ...ASAP_RECOVERY_CITIES];
export const ASAP_PAGE_BY_PATH = Object.fromEntries(ASAP_PAGES.map((p) => [p.path, p]));

export function asapOtherCities(p) {
  return ASAP_RECOVERY_CITIES.filter((o) => o.path !== p.path).map((o) => [`ASAP Recovery in ${o.city}`, o.path]);
}

export function asapLists(p) {
  return [
    ...p.sections.map((s) => [s.h, [...s.p, ...(s.list || [])]]),
    ...(p.table ? [[p.table.h, p.table.rows.map((r) => `${r[0]}: ${r.slice(1).map((v, i) => `${p.table.head[i + 1]}: ${v}`).join(" · ")}`)]] : []),
    ["Related pages", p.links],
    ...(p.otherCities ? [["ASAP Recovery in other cities", asapOtherCities(p)]] : []),
    ...(p.path === "/asap/recovery" ? [["ASAP Recovery by city", ASAP_RECOVERY_CITIES.map((o) => [`ASAP Recovery in ${o.city}`, o.path])]] : []),
    ...(p.appLinks ? [["Get the Cargo One app", ASAP_APP_LINKS]] : []),
  ];
}

export function asapJsonLd(p) {
  const url = `${SITE_URL}${p.path}`;
  const main = p.kind === "Article"
    ? { "@context": "https://schema.org", "@type": "Article", headline: p.h1, description: p.description, image: `${SITE_URL}${p.image}`, author: { "@type": "Organization", name: "Cargo One", url: SITE_URL }, publisher: { "@type": "Organization", name: "Cargo One", url: SITE_URL }, mainEntityOfPage: url }
    : { "@context": "https://schema.org", "@type": "Service", name: p.h1, serviceType: p.serviceType || "On-demand courier and vehicle recovery", description: p.description, url, provider: { "@type": "Organization", name: "Cargo One", url: SITE_URL }, areaServed: p.city ? { "@type": "City", name: p.city } : { "@type": "Country", name: "United Kingdom" } };
  const crumbs = p.crumbs.map(([name, path]) => [name, path || p.path]);
  return [main, faqJsonLd(p.faqs), breadcrumbJsonLd(crumbs)];
}
