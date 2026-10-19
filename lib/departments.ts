// ETH departments as teams: official short code, one vivid accent colour each.
// Keyed by the VVZ department id; professors are matched by department name.

export type DeptStyle = { id: number; code: string; name: string; color: string };

export const DEPARTMENTS: DeptStyle[] = [
  { id: 1, code: 'ARCH', name: 'Architecture', color: '#e8b04c' },
  { id: 2, code: 'BAUG', name: 'Civil, Environmental and Geomatic Engineering', color: '#7fb3d5' },
  { id: 3, code: 'MAVT', name: 'Mechanical and Process Engineering', color: '#f0743e' },
  { id: 5, code: 'INFK', name: 'Computer Science', color: '#3d8bff' },
  { id: 7, code: 'MTEC', name: 'Management, Technology, and Economics', color: '#c9a227' },
  { id: 8, code: 'MATH', name: 'Mathematics', color: '#9b7bff' },
  { id: 9, code: 'PHYS', name: 'Physics', color: '#2fd3c4' },
  { id: 11, code: 'BIOL', name: 'Biology', color: '#5fd068' },
  { id: 13, code: 'EAPS', name: 'Earth and Planetary Sciences', color: '#d9824b' },
  { id: 17, code: 'GESS', name: 'Humanities, Social and Political Sciences', color: '#e86a92' },
  { id: 18, code: 'ITET', name: 'Information Technology and Electrical Engineering', color: '#ffcf3e' },
  { id: 19, code: 'MATL', name: 'Materials', color: '#a8b8c8' },
  { id: 20, code: 'CHAB', name: 'Chemistry and Applied Biosciences', color: '#b06cff' },
  { id: 23, code: 'BSSE', name: 'Biosystems Science and Engineering', color: '#3fbf8f' },
  { id: 24, code: 'HEST', name: 'Health Sciences and Technology', color: '#ff5a5f' },
  { id: 25, code: 'USYS', name: 'Environmental Systems Science', color: '#8bc34a' },
];

const NEUTRAL: DeptStyle = { id: 0, code: 'ETH', name: 'ETH Zurich', color: '#b8bcc6' };
const byName = new Map(DEPARTMENTS.map((d) => [d.name.toLowerCase(), d]));
const byId = new Map(DEPARTMENTS.map((d) => [d.id, d]));

export const deptById = (id?: number | null) => (id && byId.get(id)) || NEUTRAL;
export const deptByName = (name?: string | null) => (name && byName.get(name.toLowerCase())) || NEUTRAL;
