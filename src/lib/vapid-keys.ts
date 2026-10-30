// Clés VAPID pour le protocole Web Push (Google FCM & Apple APNs)
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BOOmbEnFZGLEy9EtJU8yr5sjcZ78KlehSWxTL6nmt1JSq7wFia38aCVWwPUcxs4RSM2Uq_MdsNTDkcuG3MhyOAU";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "mMqXawOHImwHHF1R1tURh5Vni2uDc3nr7KKgFh7Xe8g";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:support@mon-trajet-eglise.fr";
