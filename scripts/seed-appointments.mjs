// Seed script: creates sample appointments for this week
const BASE = "http://localhost:3000";

const VEHICLES = {
  volvo:  "df384e54-8b02-48b2-a6a3-07056013751e",
  bmw:    "605a16e1-92e9-45d1-846b-145d3cd679a1",
  vw:     "c054ce05-0b41-4ebf-80ec-3734626f817a",
  audi:   "a0ad9118-e359-45b1-a7bb-28134f944fca",
  toyota: "b12070b5-82d7-47ff-86d7-78438208dd65",
  tesla:  "6dd1a80b-503e-4a37-b427-ebba491245b2",
};

const CUSTOMERS = {
  testkund: "ad52fe2c-9c94-436c-8d72-b3aa500dcdfe",
  erik:     "10c2c9e8-9f92-4ed7-a807-49db6ed4f93c",
  anna:     "f73b3df4-3d92-41ed-b901-a5b69a9899bb",
  karlsson: "0e61a8b6-2b3a-40f0-ac0a-99c416ca2a90",
  magnus:   "70ba835f-339e-496b-914c-441885791dd2",
};

const RESOURCES = {
  lyft1:  "a54c1ab9-2de2-4c72-9a2d-cc587ab1bcfc",
  lyft2:  "794d0366-b16c-4e82-b839-7f66f3b26fe4",
  grop:   "97d9bb52-a1f6-4f0f-a8a3-1447b63d13c8",
  dack:   "96839c92-5bd9-41c5-af5c-4d83a9102a32",
};

// Week of 2026-02-23 (Monday)
const APPTS = [
  // Monday Feb 23
  { vehicle: "volvo", customer: "testkund", resource: "lyft1", date: "2026-02-23", start: "08:00", end: "10:00", desc: "Service 6000 mil, oljebyte + filter", status: "confirmed" },
  { vehicle: "vw", customer: "erik", resource: "lyft2", date: "2026-02-23", start: "08:00", end: "11:00", desc: "Bromsbyte fram + bak", status: "confirmed" },
  { vehicle: "audi", customer: "anna", resource: "grop", date: "2026-02-23", start: "09:00", end: "10:00", desc: "Oljebyte", status: "confirmed" },
  { vehicle: "tesla", customer: "magnus", resource: "dack", date: "2026-02-23", start: "10:00", end: "11:00", desc: "Däckbyte vinter till sommar", status: "pending" },
  { vehicle: "toyota", customer: "karlsson", resource: "lyft1", date: "2026-02-23", start: "13:00", end: "15:00", desc: "Felsökning motor, kontrolllampa", status: "confirmed" },
  { vehicle: "bmw", customer: "testkund", resource: "lyft2", date: "2026-02-23", start: "13:00", end: "14:30", desc: "Inspektion och besiktningsförberedelse", status: "confirmed" },

  // Tuesday Feb 24
  { vehicle: "audi", customer: "anna", resource: "lyft1", date: "2026-02-24", start: "08:00", end: "09:30", desc: "Kamremsbyte", status: "confirmed" },
  { vehicle: "vw", customer: "erik", resource: "dack", date: "2026-02-24", start: "08:00", end: "09:00", desc: "Hjulinställning", status: "confirmed" },
  { vehicle: "toyota", customer: "karlsson", resource: "lyft2", date: "2026-02-24", start: "10:00", end: "12:00", desc: "Kopplingsreparation", status: "pending" },
  { vehicle: "volvo", customer: "testkund", resource: "grop", date: "2026-02-24", start: "13:00", end: "14:00", desc: "Underredsbehandling", status: "confirmed" },

  // Wednesday Feb 25
  { vehicle: "tesla", customer: "magnus", resource: "lyft1", date: "2026-02-25", start: "08:00", end: "10:00", desc: "Bromsskivor + belägg", status: "confirmed" },
  { vehicle: "bmw", customer: "testkund", resource: "lyft2", date: "2026-02-25", start: "09:00", end: "11:00", desc: "Fjäderbenslagring + stötdämpare", status: "confirmed" },
  { vehicle: "vw", customer: "erik", resource: "grop", date: "2026-02-25", start: "11:00", end: "12:00", desc: "Avgasläcka reparation", status: "confirmed" },
  { vehicle: "audi", customer: "anna", resource: "dack", date: "2026-02-25", start: "14:00", end: "15:00", desc: "Däckbyte + balansering", status: "confirmed" },
  { vehicle: "volvo", customer: "testkund", resource: "lyft1", date: "2026-02-25", start: "13:00", end: "16:00", desc: "AC-service + påfyllning", status: "pending" },

  // Thursday Feb 26
  { vehicle: "toyota", customer: "karlsson", resource: "lyft1", date: "2026-02-26", start: "08:00", end: "10:00", desc: "Service 3000 mil", status: "confirmed" },
  { vehicle: "tesla", customer: "magnus", resource: "lyft2", date: "2026-02-26", start: "08:00", end: "09:30", desc: "Hjullagerbyte", status: "confirmed" },
  { vehicle: "bmw", customer: "testkund", resource: "dack", date: "2026-02-26", start: "10:00", end: "11:00", desc: "Däckhotell inlämning", status: "confirmed" },
  { vehicle: "audi", customer: "anna", resource: "grop", date: "2026-02-26", start: "13:00", end: "14:00", desc: "Oljebyte + filterpaket", status: "confirmed" },

  // Friday Feb 27
  { vehicle: "volvo", customer: "testkund", resource: "lyft1", date: "2026-02-27", start: "08:00", end: "11:00", desc: "Besiktningsförberedelse komplett", status: "confirmed" },
  { vehicle: "vw", customer: "erik", resource: "lyft2", date: "2026-02-27", start: "08:00", end: "10:00", desc: "Kulled + länkarm", status: "confirmed" },
  { vehicle: "toyota", customer: "karlsson", resource: "grop", date: "2026-02-27", start: "10:00", end: "11:00", desc: "Underredsinspektion", status: "pending" },
  { vehicle: "tesla", customer: "magnus", resource: "dack", date: "2026-02-27", start: "13:00", end: "14:00", desc: "Däckbyte 4st", status: "confirmed" },
  { vehicle: "bmw", customer: "testkund", resource: "lyft1", date: "2026-02-27", start: "13:00", end: "15:00", desc: "Motordiagnos + felsökning", status: "confirmed" },
];

async function createAppointment(appt) {
  const body = {
    vehicleId: VEHICLES[appt.vehicle],
    customerId: CUSTOMERS[appt.customer],
    resourceId: RESOURCES[appt.resource],
    scheduledStart: `${appt.date}T${appt.start}:00`,
    scheduledEnd: `${appt.date}T${appt.end}:00`,
    serviceDescription: appt.desc,
    status: appt.status,
  };

  const res = await fetch(`${BASE}/api/kalender`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`  OK  ${appt.date} ${appt.start}-${appt.end} ${appt.resource}: ${appt.desc.substring(0, 30)}`);
  } else {
    console.log(`  ERR ${appt.date} ${appt.start}-${appt.end} ${appt.resource}: ${data.error}`);
  }
  return data;
}

async function main() {
  console.log(`Seeding ${APPTS.length} appointments...`);
  for (const appt of APPTS) {
    await createAppointment(appt);
  }
  console.log("Done!");
}

main().catch(console.error);
