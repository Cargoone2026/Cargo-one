// Cargo One marketing imagery — ported verbatim from the Expo source.
// URLs go through images.unsplash.com CDN with responsive sizing.

const U = (id, w = 800, q = 75) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=${q}&fm=jpg`;

export const CATEGORY_IMAGES = {
  house_moves: U("photo-1600585154526-990dced4db0d"),
  furniture: U("photo-1555041469-a586c61ea9bc"),
  vehicles: U("photo-1552519507-da3b142c6e3d"),
  motorcycles: U("photo-1558981806-ec527fa84c39"),
  caravans: U("photo-1523987355523-c7b5b0dd90a7"),
  static_caravans: U("photo-1750698242388-51627cb26a4c"),
  shipping_containers: U("photo-1494412651409-8963ce7935a7"),
  machinery: U("photo-1649807533255-bbc9c9fb7d77"),
  pallets: U("photo-1553413077-190dd305871c"),
  boats: U("photo-1559385301-0187cb6eff46"),
  office_moves: U("photo-1497366216548-37526070297c"),
  building_materials: U("photo-1503387762-592deb58ef4e"),
  parcels: U("photo-1587293852726-70cdb56c2866"),
  freight: U("photo-1580654712603-eb43273aff33"),
  same_day: U("photo-1526367790999-0150786686a2"),
  documents: U("photo-1450101499163-c8848c66ca85"),
  single_items: U("photo-1587293852726-70cdb56c2866"),
  agricultural: U("photo-1500595046743-cd271d694d30"),
  garden_outdoor: U("photo-1416879595882-3373a0480b5b"),
  retail_business: U("photo-1441986300917-64674bd600d8"),
  event_equipment: U("photo-1470229722913-7c0e2dbbafd3"),
  auction_marketplace: U("photo-1607083206968-13611e3d76db"),
  long_distance_uk: U("photo-1580674285054-bed31e145f59"),
  fragile_high_value: U("photo-1578932750294-f5075e85f44a"),
  vans: U("photo-1570125909232-eb263c188f7e"),
};

export const IMG = {
  heroHome: U("photo-1601584115197-04ecc0da31d7", 1920, 80),
  heroHome2: U("photo-1587293852726-70cdb56c2866", 1920, 80),
  heroDrivers: U("photo-1616432043562-3671ea2e5242", 1920, 80),
  heroBusiness: U("photo-1553413077-190dd305871c", 1920, 80),
  heroServices: U("photo-1494412574745-90635abbdd8b", 1920, 80),
  heroTrust: U("photo-1600585154340-be6161a56a0c", 1920, 80),
  heroContact: U("photo-1568605114967-8130f3a36994", 1920, 80),
  heroFaq: U("photo-1586528116311-ad8dd3c8310d", 1920, 80),
  heroHow: U("photo-1580674285054-bed31e145f59", 1920, 80),
  heroAbout: U("photo-1586528116493-a029325540fa", 1920, 80),
  heroWelcome: U("photo-1620455800201-7f00aeef12ed", 1920, 80),
  cardApp: U("photo-1512428559087-560fa5ceab42", 1200, 80),
  cardTeam: U("photo-1573497019418-b400bb3ab074", 1200, 80),
};

export const DEFAULT_CARD_IMAGE = IMG.heroHome;
