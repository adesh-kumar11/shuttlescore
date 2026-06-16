import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAh-O7VYp3difqPM7Zu_bhTvbfoURSdTNc",
  authDomain: "shuttlescore-98ba5.firebaseapp.com",
  projectId: "shuttlescore-98ba5",
  storageBucket: "shuttlescore-98ba5.firebasestorage.app",
  messagingSenderId: "719237539335",
  appId: "1:719237539335:web:2b7a6369a4854d79f52ca2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const set$ = async (ref, data) => { await setDoc(ref, { ...data, _t: Date.now() }); };
const d = (room, type) => doc(db, "rooms", `${room}__${type}`);

export const saveRoomMeta   = (r,data) => set$(d(r,"meta"), data);
export const saveLiveMatch  = (r,data) => set$(d(r,"live"), data);
export const savePlayers    = (r,data) => set$(d(r,"players"), { players: data });
export const saveTeams      = (r,data) => set$(d(r,"teams"), { teams: data });
export const saveHistory    = (r,data) => set$(d(r,"history"), { history: data });
export const saveTournament = (r,data) => set$(d(r,"tournament"), data);
export const getRoomMeta    = (r) => getDoc(d(r,"meta")).then(s => s.exists() ? s.data() : null);

export const subscribeLiveMatch  = (r,cb) => onSnapshot(d(r,"live"),       s => s.exists() && cb(s.data()));
export const subscribePlayers    = (r,cb) => onSnapshot(d(r,"players"),    s => s.exists() && cb(s.data().players||[]));
export const subscribeTeams      = (r,cb) => onSnapshot(d(r,"teams"),      s => s.exists() && cb(s.data().teams||[]));
export const subscribeHistory    = (r,cb) => onSnapshot(d(r,"history"),    s => s.exists() && cb(s.data().history||[]));
export const subscribeTournament = (r,cb) => onSnapshot(d(r,"tournament"), s => s.exists() && cb(s.data()));
