// Transport directory A-Z entries + client-side search. No imports (also loaded by scripts/prerender.mjs).
// postJobCategory is intentionally not set: public post-job links go via sign-up, so no ?category= is added.
export const DIRECTORY_ENTRIES = [
  { label: "Appliances (washing machine, fridge, cooker)", path: "/services/appliance-delivery", aliases: ["appliance", "white goods", "dishwasher", "tumble dryer"], line: "Usually moved upright in a van; say whether it's disconnected and drained." },
  { label: "Agricultural machinery & tractors", path: "/services/agricultural-machinery-transport", aliases: ["tractor", "farm machinery", "combine", "quad"], line: "Moved on a low-loader or flatbed; add the make, model, weight and loading access." },
  { label: "Antiques", path: "/services/fragile-and-high-value-delivery", aliases: ["antique", "heirloom", "clock", "mirror"], line: "Mark the job as fragile, describe the piece and say how it's wrapped." },
  { label: "Beds & mattresses", path: "/services/bed-and-mattress-delivery", aliases: ["bed", "mattress", "divan", "bunk bed", "headboard"], line: "Wrap the mattress and say whether the frame is assembled or flat." },
  { label: "Bicycles", path: "/services/bike-and-bicycle-delivery", aliases: ["bike", "bicycle", "e-bike", "ebike", "cycle"], line: "Say how many bikes, whether they're boxed and if any are e-bikes." },
  { label: "Boats & jet skis", path: "/services/boat-transport", aliases: ["boat", "dinghy", "kayak", "rib", "jetski"], line: "Usually towed on its trailer or carried on a flatbed; add the length and weight." },
  { label: "Breakdown recovery", path: "/asap/recovery", aliases: ["breakdown", "broken down", "recovery", "car broke down"], line: "Get somewhere safe first, then book ASAP Recovery 24/7 and track the driver live." },
  { label: "Building materials", path: "/services/building-materials-delivery", aliases: ["bricks", "timber", "plasterboard", "sand", "cement"], line: "Add the load size, weight and how it will be unloaded on site." },
  { label: "Business deliveries", path: "/services/business-and-retail-deliveries", aliases: ["business", "b2b", "stock", "trade delivery"], line: "Add collection and delivery times, references and any site rules." },
  { label: "Big parcels", path: "/services/large-item-courier", aliases: ["big parcel", "large parcel", "bulky parcel", "big box"], line: "Add the measurements and weight so drivers can choose the right van." },
  { label: "Cars", path: "/services/car-transport", aliases: ["car", "car transport", "vehicle", "car delivery"], line: "Moved on a car transporter or trailer; add the make, model and whether it runs." },
  { label: "Car won't start", path: "/services/non-runner-car-transport", aliases: ["won't start", "wont start", "non runner", "dead car", "flat battery"], line: "Say it doesn't run, whether you have the keys and whether the wheels turn." },
  { label: "Car recovery near me", path: "/asap/recovery", aliases: ["car recovery", "recovery near me", "roadside"], line: "Book ASAP Recovery 24/7 and follow the recovery driver on the map." },
  { label: "Caravans (touring)", path: "/services/caravan-transport", aliases: ["caravan", "touring caravan", "trailer tent"], line: "Usually towed; describe the hitch, tyres and brakes." },
  { label: "Classic cars", path: "/services/classic-car-transport", aliases: ["classic", "vintage car", "show car"], line: "Often moved enclosed; describe the car and any loading needs." },
  { label: "Containers", path: "/services/shipping-container-transport", aliases: ["container", "shipping container", "site office"], line: "Moved on a Hiab or tilt-bed; add the size and the drop spot." },
  { label: "Cookers", path: "/services/appliance-delivery", aliases: ["cooker", "oven", "range cooker", "hob"], line: "Gas cookers should be disconnected by a qualified engineer before collection." },
  { label: "Courier (same day)", path: "/services/same-day-courier", aliases: ["courier", "same day", "urgent delivery"], line: "For urgent jobs, book ASAP Transport and track the driver live." },
  { label: "Documents", path: "/services/document-courier", aliases: ["document", "papers", "contracts", "envelope"], line: "Add who's handing over and receiving them, and any signing details." },
  { label: "Desks & office furniture", path: "/services/office-removals", aliases: ["desk", "office chair", "filing cabinet", "office furniture"], line: "List the items and add floors, lifts and building access times." },
  { label: "Dining tables", path: "/services/furniture-delivery", aliases: ["dining table", "table", "dining chairs"], line: "Say whether the legs come off and add the table's size." },
  { label: "eBay & Marketplace collections", path: "/services/marketplace-collection", aliases: ["ebay", "marketplace", "facebook marketplace", "gumtree", "auction"], line: "Add the seller's address, when they're available and any collection reference." },
  { label: "Event equipment", path: "/services/event-equipment-transport", aliases: ["event", "staging", "marquee", "exhibition", "pa system"], line: "Add the venue's access, load-in times and any site contact." },
  { label: "Exercise equipment", path: "/services/gym-equipment-delivery", aliases: ["exercise", "exercise bike", "rowing machine", "cross trainer"], line: "Add the weight, whether it folds and the stairs at each end." },
  { label: "Flat-pack furniture", path: "/services/wardrobe-and-flat-pack-delivery", aliases: ["flat pack", "flatpack", "store collection", "ikea"], line: "Have the order number and collection reference ready for store pickups." },
  { label: "Fragile items", path: "/services/fragile-and-high-value-delivery", aliases: ["fragile", "glass", "artwork", "high value"], line: "Mark the job as fragile and describe how the item is packed." },
  { label: "Freight & haulage", path: "/services/freight-and-haulage", aliases: ["freight", "haulage", "lorry", "hgv", "full load"], line: "Add the load type, weight and loading facilities at both ends." },
  { label: "Fridges & freezers", path: "/services/appliance-delivery", aliases: ["fridge", "freezer", "fridge freezer", "american fridge"], line: "Empty, defrost and dry it, and keep it upright where possible." },
  { label: "Furniture", path: "/services/furniture-delivery", aliases: ["furniture", "chest of drawers", "sideboard", "bookcase"], line: "List the pieces and add sizes, stairs and whether you need help carrying." },
  { label: "Garden furniture, sheds & BBQs", path: "/services/garden-and-outdoor-items", aliases: ["garden furniture", "bbq", "barbecue", "patio set", "planter"], line: "Say whether the item is assembled and how it will be loaded." },
  { label: "Gym equipment & treadmills", path: "/services/gym-equipment-delivery", aliases: ["gym", "treadmill", "weights", "home gym", "multi gym"], line: "Fold or dismantle it if you can, and add the weight and stairs." },
  { label: "Horseboxes", path: "/services/horsebox-and-trailer-transport", aliases: ["horsebox", "horse box", "horse trailer"], line: "Describe the horsebox, its size, its weight and how it hitches." },
  { label: "Hot tubs", path: "/services/hot-tub-delivery", aliases: ["hot tub", "spa", "jacuzzi", "swim spa"], line: "Mention access, stairs and weight in the job so suitable drivers can quote." },
  { label: "House moves", path: "/services/house-removals", aliases: ["house move", "moving house", "move home", "removal", "relocation"], line: "List the rooms and large items, and add access at both homes." },
  { label: "Jet skis", path: "/services/boat-transport", aliases: ["jet ski", "jetski", "pwc", "seadoo"], line: "Usually moved on its trailer; add the trailer details and weight." },
  { label: "Large items", path: "/services/large-item-courier", aliases: ["large item", "bulky item", "big item", "large goods", "oversized"], line: "Measure it, add the weight and say whether you need help carrying." },
  { label: "Lawn mowers & ride-on mowers", path: "/services/garden-and-outdoor-items", aliases: ["lawn mower", "lawnmower", "ride on mower", "mower"], line: "Drain or secure the fuel and say whether it can be driven up a ramp." },
  { label: "Long-distance moves", path: "/services/long-distance-removals", aliases: ["long distance", "move across the uk", "moving far"], line: "Add both addresses, the rooms and any overnight or storage needs." },
  { label: "Man and van", path: "/services/man-and-van", aliases: ["man with a van", "man & van", "van and driver", "small move"], line: "List what you're moving and say how much help you need loading." },
  { label: "Machinery & plant", path: "/services/machinery-haulage", aliases: ["machinery", "plant", "digger", "excavator", "forklift"], line: "Add the machine, its weight and how it will be loaded." },
  { label: "Mattresses", path: "/services/bed-and-mattress-delivery", aliases: ["mattress", "memory foam", "topper"], line: "Wrap it so it stays clean and dry, and add the size." },
  { label: "Motorbikes & scooters", path: "/services/motorbike-transport", aliases: ["motorbike", "motorcycle", "scooter", "moped", "dirt bike"], line: "Say whether it runs and whether it's on a stand or needs pushing." },
  { label: "Motorhomes", path: "/services/caravan-transport", aliases: ["motorhome", "camper", "campervan", "rv"], line: "Add the size and weight and whether it can be driven onto a vehicle." },
  { label: "Non-runner vehicles", path: "/services/non-runner-car-transport", aliases: ["non-runner", "non runner", "broken car", "scrap car", "project car"], line: "Say whether it has keys and whether the wheels turn and steer." },
  { label: "Office moves", path: "/services/office-removals", aliases: ["office move", "office relocation", "it equipment"], line: "Add the floors, lifts and the building's access times." },
  { label: "Pallets", path: "/services/pallet-delivery", aliases: ["pallet", "palette", "skid", "pallet delivery"], line: "Add the pallet size, weight and whether there's a forklift or tail lift." },
  { label: "Parcels", path: "/services/parcel-delivery", aliases: ["parcel", "package", "box", "small box"], line: "Add the size and weight; for big boxes see large items." },
  { label: "Pianos", path: "/services/piano-transport", aliases: ["piano", "upright piano", "keyboard"], line: "Mention access, stairs and weight in the job so suitable drivers can quote." },
  { label: "Recovery truck / tow truck near me", path: "/asap/recovery", aliases: ["tow truck", "recovery truck", "tow truck near me", "flatbed recovery"], line: "Book ASAP Recovery 24/7; available drivers near you are alerted first." },
  { label: "Removals", path: "/services/house-removals", aliases: ["removals", "removal company", "movers"], line: "List the rooms and bulky items so drivers can choose the right van." },
  { label: "Same day courier", path: "/services/same-day-courier", aliases: ["same day courier", "today", "urgent courier"], line: "Book ASAP Transport for jobs that need doing now." },
  { label: "Sheds", path: "/services/garden-and-outdoor-items", aliases: ["shed", "summer house", "greenhouse", "log store"], line: "Say whether it's dismantled into panels and add the panel sizes." },
  { label: "Shop deliveries", path: "/services/business-and-retail-deliveries", aliases: ["shop", "retail", "store delivery", "customer delivery"], line: "Add delivery windows and any references your customers need." },
  { label: "Single items", path: "/services/single-item-delivery", aliases: ["single item", "one item", "just one thing"], line: "Describe the item, its size and whether you need help carrying." },
  { label: "Sofas & corner sofas", path: "/services/sofa-delivery", aliases: ["sofa", "settee", "couch", "corner sofa", "sofa bed", "armchair"], line: "Measure it and say whether it splits into sections." },
  { label: "Static caravans", path: "/services/static-caravan-transport", aliases: ["static caravan", "static", "lodge", "mobile home"], line: "Add the unit size, the park's rules and the access on site." },
  { label: "Student moves", path: "/services/student-moves", aliases: ["student", "university", "uni move", "halls"], line: "List your boxes and items and add halls or building access rules." },
  { label: "Towing / car towing", path: "/asap/recovery", aliases: ["tow", "towing", "car towing", "tow my car"], line: "If you're on a live motorway, the official services move the vehicle first." },
  { label: "Tractors", path: "/services/agricultural-machinery-transport", aliases: ["tractor", "compact tractor", "farm"], line: "Add the make, model and weight and any attachments." },
  { label: "Trailers", path: "/services/horsebox-and-trailer-transport", aliases: ["trailer", "car trailer", "box trailer", "plant trailer"], line: "Describe the trailer, its hitch and whether it's loaded." },
  { label: "TVs", path: "/services/fragile-and-high-value-delivery", aliases: ["tv", "television", "screen", "monitor"], line: "Use the original box if you have it and keep it upright." },
  { label: "Vans", path: "/services/van-transport", aliases: ["van", "van transport", "commercial vehicle"], line: "Add the van's size and whether it runs." },
  { label: "Vehicle recovery", path: "/services/vehicle-recovery", aliases: ["vehicle recovery", "recover my car", "accident damaged"], line: "If it needs moving now, book ASAP Recovery; for a planned date, post a recovery job." },
  { label: "Wardrobes", path: "/services/wardrobe-and-flat-pack-delivery", aliases: ["wardrobe", "armoire", "closet"], line: "Empty it and take the doors off if you can." },
  { label: "Washing machines", path: "/services/appliance-delivery", aliases: ["washing machine", "washer", "washer dryer"], line: "Fit the transit bolts if you have them and drain the hoses." },
];

export const DIRECTORY_LETTERS = [...new Set(DIRECTORY_ENTRIES.map((e) => e.label[0].toUpperCase()))].sort();

export function directoryByLetter() {
  return DIRECTORY_LETTERS.map((l) => [l, DIRECTORY_ENTRIES.filter((e) => e.label[0].toUpperCase() === l).sort((a, b) => a.label.localeCompare(b.label))]);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();

export function searchDirectory(query, max = 6) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const e of DIRECTORY_ENTRIES) {
    const terms = [e.label, ...e.aliases].map(norm);
    let score = 0;
    for (const t of terms) {
      if (t === q) score = Math.max(score, 3);
      else if (t.startsWith(q)) score = Math.max(score, 2);
      else if (t.includes(q) || (q.length > 3 && q.includes(t))) score = Math.max(score, 1);
    }
    if (score) scored.push([score, e]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].label.localeCompare(b[1].label));
  return scored.slice(0, max).map(([, e]) => e);
}
