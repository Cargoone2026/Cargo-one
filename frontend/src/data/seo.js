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
  { path: "/how-it-works", title: "How It Works | Cargo One", h1: "How it works", description: "Six simple steps to book a delivery on Cargo One. Post a job, compare quotes from vetted UK drivers, pay a small booking fee via Stripe, and track live to your doorstep." },
  { path: "/services", title: "Delivery Services | Cargo One", h1: "Delivery services", description: "Everything Cargo One moves — parcels, pallets, house moves, vehicles, motorcycles, freight, and commercial logistics. Book a vetted UK driver in minutes." },
  { path: "/business", title: "Business Accounts | Cargo One", h1: "Cargo One for Business", description: "Cargo One for Business — UK logistics on tap. Volume discounts, monthly invoicing, priority driver matching, API access and enterprise SLAs." },
  { path: "/drivers", title: "Become a Driver | Cargo One", h1: "Drive with Cargo One", description: "Join Cargo One as a driver and earn on your own terms. No commission on driver bids, verified customers, and instant on-delivery payments across the UK." },
  { path: "/faq", title: "FAQ | Cargo One", h1: "Frequently asked questions", description: "Frequently asked questions about Cargo One — pricing, driver verification, secure payments, live tracking, and proof of delivery." },
  { path: "/contact", title: "Contact Us | Cargo One", h1: "Contact us", description: "Get in touch with Cargo One — customer support, driver support, business enquiries and press. 24/7 assistance for urgent safety concerns." },
  { path: "/trust-safety", title: "Trust & Safety | Cargo One", h1: "Trust & Safety", description: "How Cargo One keeps deliveries safe — driver verification, Stripe secure payments, live GPS tracking, photo proof of delivery, and GDPR-compliant data handling." },
  { path: "/about", title: "About Cargo One", h1: "About Cargo One", description: "Meet Cargo One — the fair, transparent UK logistics marketplace matching customers with vetted drivers. Our mission, values and story." },
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
