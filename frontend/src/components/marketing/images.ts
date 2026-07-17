// Curated Unsplash hero and section imagery for the Cargo One marketing site.
// URLs are optimised for web/mobile: 800px card size at q=75 (~35-60kB each) and
// 1920px hero size at q=80. Reusable helper `pickImage(key)` provides a safe
// fallback if an image URL fails to load.

const U = (id: string, w = 800, q = 75) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=${q}&fm=jpg`;

// -- Category-accurate card imagery --------------------------------------
// Every "What We Move" card and Services-page card resolves through this map
// so the exact image is guaranteed to match the service being offered.
export const CATEGORY_IMAGES: Record<string, string> = {
  house_moves:         U("photo-1600585154526-990dced4db0d"), // full house move
  furniture:           U("photo-1555041469-a586c61ea9bc"),    // sofa/furniture in living room
  vehicles:            U("photo-1552519507-da3b142c6e3d"),    // luxury car
  motorcycles:         U("photo-1558981806-ec527fa84c39"),    // motorcycle side profile
  caravans:            U("photo-1523987355523-c7b5b0dd90a7"), // touring caravan pitched
  static_caravans:     U("photo-1750698242388-51627cb26a4c"), // static caravans on a holiday park
  shipping_containers: U("photo-1494412651409-8963ce7935a7"), // stacked shipping containers
  machinery:           U("photo-1649807533255-bbc9c9fb7d77"), // yellow excavator / plant machinery
  pallets:             U("photo-1553413077-190dd305871c"),    // warehouse pallets & racking
  boats:               U("photo-1559385301-0187cb6eff46"),    // luxury motor yacht
  office_moves:        U("photo-1497366216548-37526070297c"), // modern office
  building_materials:  U("photo-1503387762-592deb58ef4e"),    // bricks & building supplies
  parcels:             U("photo-1587293852726-70cdb56c2866"), // stack of parcels/boxes
  freight:             U("photo-1580654712603-eb43273aff33"), // freight/logistics operations
  same_day:            U("photo-1526367790999-0150786686a2"), // bike courier / same-day
  documents:           U("photo-1450101499163-c8848c66ca85"), // documents
  single_items:        U("photo-1587293852726-70cdb56c2866"), // packed cardboard boxes
  agricultural:        U("photo-1500595046743-cd271d694d30"), // tractor / farm
  garden_outdoor:      U("photo-1416879595882-3373a0480b5b"), // garden furniture/plants
  retail_business:     U("photo-1441986300917-64674bd600d8"), // retail storefront
  event_equipment:     U("photo-1470229722913-7c0e2dbbafd3"), // event / stage
  auction_marketplace: U("photo-1607083206968-13611e3d76db"), // packaged items ready to ship
  long_distance_uk:    U("photo-1580674285054-bed31e145f59"), // long distance highway truck
  fragile_high_value:  U("photo-1578932750294-f5075e85f44a"), // art/museum piece
  vans:                U("photo-1570125909232-eb263c188f7e"), // work van
};

// -- Hero images ---------------------------------------------------------
export const IMG = {
  heroHome:     U("photo-1601584115197-04ecc0da31d7", 1920, 80),
  heroHome2:    U("photo-1587293852726-70cdb56c2866", 1920, 80),
  heroDrivers:  U("photo-1616432043562-3671ea2e5242", 1920, 80),
  heroBusiness: U("photo-1553413077-190dd305871c", 1920, 80),
  heroServices: U("photo-1494412574745-90635abbdd8b", 1920, 80),
  heroTrust:    U("photo-1600585154340-be6161a56a0c", 1920, 80),
  heroContact:  U("photo-1568605114967-8130f3a36994", 1920, 80),
  heroFaq:      U("photo-1586528116311-ad8dd3c8310d", 1920, 80),
  heroHow:      U("photo-1580674285054-bed31e145f59", 1920, 80),
  heroAbout:    U("photo-1586528116493-a029325540fa", 1920, 80),

  // Kept for backwards compatibility with older screens
  cardParcel:  CATEGORY_IMAGES.parcels,
  cardPallet:  CATEGORY_IMAGES.pallets,
  cardHouse:   CATEGORY_IMAGES.house_moves,
  cardVehicle: CATEGORY_IMAGES.vehicles,
  cardFreight: CATEGORY_IMAGES.freight,
  cardMoto:    CATEGORY_IMAGES.motorcycles,
  cardApp:     U("photo-1512428559087-560fa5ceab42", 1200, 80),
  cardTeam:    U("photo-1573497019418-b400bb3ab074", 1200, 80),
};

// Safe universal fallback — used by <CardImage /> if a category URL 404s.
export const DEFAULT_CARD_IMAGE = IMG.heroHome;

/** Pick a category-specific image, or the global fallback if unknown. */
export function pickCategoryImage(key: string | undefined | null): string {
  if (!key) return DEFAULT_CARD_IMAGE;
  return CATEGORY_IMAGES[key] || DEFAULT_CARD_IMAGE;
}
