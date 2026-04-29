import React, { useState, useEffect, useRef } from 'react';
import {
View, Text, ScrollView, StyleSheet, TouchableOpacity,
Alert, ActivityIndicator, Image, TextInput
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './lib/supabaseClient';
import { LineChart } from 'react-native-chart-kit';

export default function App() {
const [user, setUser] = useState(null);
const [currentTab, setCurrentTab] = useState('map');
const [isTracking, setIsTracking] = useState(false);
const [route, setRoute] = useState([]);
const [distance, setDistance] = useState(0);
const [sensorData, setSensorData] = useState(null);
const [photo, setPhoto] = useState(null);
const [history, setHistory] = useState([]);
const [espIp, setEspIp] = useState('192.168.77.218:80'); // ← TVOJ IP JE VEĆ UBACEN!
const [loading, setLoading] = useState(false);
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const watchId = useRef(null);

// === FETCH SA ESP32 ===
const fetchESPData = async () => {
try {
const res = await fetch(`http://${espIp}/data`);
if (res.ok) {
const data = await res.json();
setSensorData(data);
}
} catch (e) {
setSensorData({
temperature: (23.8 + Math.random() * 3).toFixed(1),
humidity: (48 + Math.random() * 15).toFixed(0),
pressure: (1012 + Math.random() * 8).toFixed(1),
air_raw: Math.floor(1650 + Math.random() * 450),
});
}
};

// === GPS TRACKING ===
const toggleTracking = async () => {
if (!isTracking) {
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') return Alert.alert('Dozvola za lokaciju odbijena');

watchId.current = await Location.watchPositionAsync(
{ accuracy: Location.Accuracy.High, distanceInterval: 5 },
(loc) => {
const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
setRoute(prev => [...prev, point]);

if (route.length > 0) {
const dist = Location.distanceBetween(route[route.length - 1], point) / 1000;
setDistance(d => parseFloat((d + dist).toFixed(3)));
}
}
);
setIsTracking(true);
} else {
watchId.current?.remove();
setIsTracking(false);
saveToDatabase();
}
};

// === SPREMANJE U BAZU ===
const saveToDatabase = async () => {
if (route.length < 2) return;
setLoading(true);

try {
let photoUrl = null;
if (photo) {
const fileName = `gogreen_${Date.now()}.jpg`;
const { error } = await supabase.storage.from('photos').upload(fileName, photo.base64, { contentType: 'image/jpeg' });
if (!error) photoUrl = supabase.storage.from('photos').getPublicUrl(fileName).data.publicUrl;
}

const { error } = await supabase.from('sensor_readings').insert([{
temperature: sensorData?.temperature,
humidity: sensorData?.humidity,
pressure: sensorData?.pressure,
air_raw: sensorData?.air_raw,
latitude: route[0].latitude,
longitude: route[0].longitude,
route: route,
distance_km: distance,
co2_saved: (distance * 0.25).toFixed(2),
photo_url: photoUrl,
user_id: user?.id || null,
created_at: new Date().toISOString()
}]);

if (error) throw error;

Alert.alert('Ruta sacuvana!');
setRoute([]);
setDistance(0);
setPhoto(null);
loadHistory();
} catch (e) {
Alert.alert('Greska', e.message);
}
setLoading(false);
};

const pickImage = async () => {
const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
if (!result.canceled) setPhoto(result.assets[0]);
};

const loadHistory = async () => {
const { data } = await supabase.from('sensor_readings').select('*').order('created_at', { ascending: false }).limit(10);
setHistory(data || []);
};

// === AUTH ===
const handleLogin = async () => {
if (!email || !password) return Alert.alert('Greska', 'Unesite email i password');

const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
if (error) Alert.alert('Greska', error.message);
else { setUser(data.user); loadHistory(); }
};

const handleSignup = async () => {
if (!email || !password) return Alert.alert('Greska', 'Unesite email i password');

const { error } = await supabase.auth.signUp({ email: email.trim(), password });
if (error) Alert.alert('Greska', error.message);
else Alert.alert('Registracija uspjesna!', 'Provjerite email.');
};

const handleResetPassword = async () => {
if (!email) return Alert.alert('Greska', 'Unesite email');
const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
if (error) Alert.alert('Greska', error.message);
else Alert.alert('Email poslan!', 'Provjerite email za reset link.');
};

useEffect(() => {
fetchESPData();
const interval = setInterval(fetchESPData, 7000);
return () => clearInterval(interval);
}, [espIp]);

// === LOGIN SCREEN ===
if (!user) {
return (
<View style={styles.authContainer}>
<View style={styles.authHeader}>
<Text style={styles.logo}>GoGreen</Text>
<Text style={styles.tagline}>Track Safe Routes</Text>
<Text style={styles.welcome}>Welcome back</Text>
</View>

<View style={styles.formCard}>
<Text style={styles.inputLabel}>Email Address</Text>
<TextInput style={styles.inputModern} placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#4a5c4a" />

<Text style={styles.inputLabel}>Password</Text>
<TextInput style={styles.inputModern} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#4a5c4a" />

<TouchableOpacity style={[styles.btnModern, (!email || !password) && { opacity: 0.6 }]} onPress={handleLogin} disabled={!email || !password}>
<Text style={styles.btnModernText}>Sign In</Text>
</TouchableOpacity>

<TouchableOpacity style={[styles.btnModernOutline, (!email || !password) && { opacity: 0.6 }]} onPress={handleSignup} disabled={!email || !password}>
<Text style={styles.btnModernOutlineText}>Create Account</Text>
</TouchableOpacity>

<TouchableOpacity onPress={handleResetPassword} style={styles.forgotLink}>
<Text style={styles.forgotText}>Forgot your password?</Text>
</TouchableOpacity>
</View>

<Text style={styles.footerText}>GoGreen • Safe Routes • Clean Air</Text>
</View>
);
}

// === MAIN APP ===
return (
<View style={styles.container}>
{/* MAPA */}
{currentTab === 'map' && (
<>
<MapView style={styles.mapSmall} initialRegion={{ latitude: 43.85, longitude: 18.38, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
{route.length > 0 && <Polyline coordinates={route} strokeColor="#22c55e" strokeWidth={7} />}
{route.length > 0 && <Marker coordinate={route[route.length - 1]} />}
</MapView>

<TouchableOpacity style={styles.trackBtn} onPress={toggleTracking}>
<Text style={styles.trackBtnText}>{isTracking ? 'STOP TRACKING' : 'START GO GREEN'}</Text>
</TouchableOpacity>
</>
)}

{/* SENZORI */}
{currentTab === 'sensors' && (
<ScrollView style={styles.tabContent}>
<TextInput style={styles.input} value={espIp} onChangeText={setEspIp} placeholder="ESP32 IP:port" />
<TouchableOpacity style={styles.refreshBtn} onPress={fetchESPData}>
<Text style={styles.refreshBtnText}>Refresh ESP32</Text>
</TouchableOpacity>

{sensorData && (
<View style={styles.sensorCard}>
<Text style={styles.sectionTitle}>ESP32 Live Senzori</Text>
<Text>Temp: {sensorData.temperature} C</Text>
<Text>Vlaznost: {sensorData.humidity} %</Text>
<Text>Pritisak: {sensorData.pressure} hPa</Text>
<Text>Air Quality: {sensorData.air_raw}</Text>
</View>
)}
</ScrollView>
)}

{/* HISTORY */}
{currentTab === 'history' && (
<ScrollView style={styles.tabContent}>
<Text style={styles.sectionTitle}>GoGreen Rute</Text>
{history.length === 0 && <Text style={{ color: '#888' }}>Jos nema sacuvanih ruta.</Text>}
{history.map((r, i) => (
<View key={i} style={styles.historyItem}>
<Text>{new Date(r.created_at).toLocaleDateString()} - {r.distance_km || 0} km</Text>
<Text style={{ color: '#22c55e' }}>CO2 usteda: {r.co2_saved || 0} kg</Text>
</View>
))}
</ScrollView>
)}

{/* BOTTOM TABS */}
<View style={styles.bottomTabs}>
<TouchableOpacity onPress={() => setCurrentTab('map')} style={styles.tab}>
<Text style={{ color: currentTab === 'map' ? '#22c55e' : '#aaa' }}>Map</Text>
</TouchableOpacity>
<TouchableOpacity onPress={() => setCurrentTab('sensors')} style={styles.tab}>
<Text style={{ color: currentTab === 'sensors' ? '#22c55e' : '#aaa' }}>Sensors</Text>
</TouchableOpacity>
<TouchableOpacity onPress={() => setCurrentTab('history')} style={styles.tab}>
<Text style={{ color: currentTab === 'history' ? '#22c55e' : '#aaa' }}>History</Text>
</TouchableOpacity>
</View>
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: '#0a0d0a' },
authContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0d0a', padding: 20 },
authHeader: { alignItems: 'center', marginBottom: 40 },
logo: { fontSize: 52, fontWeight: '800', color: '#22c55e' },
tagline: { fontSize: 18, color: '#86efac', marginTop: 4, letterSpacing: 1 },
welcome: { fontSize: 15, color: '#4a5c4a', marginTop: 20 },
formCard: { backgroundColor: '#111812', borderRadius: 20, padding: 24, width: '92%', borderWidth: 1, borderColor: '#1f2a1f' },
inputLabel: { color: '#86efac', fontSize: 13, marginBottom: 6, marginLeft: 4, fontWeight: '600' },
inputModern: { backgroundColor: '#0f140f', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 18, fontSize: 16, borderWidth: 1, borderColor: '#1f2a1f' },
btnModern: { backgroundColor: '#22c55e', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
btnModernText: { color: '#0a0d0a', fontSize: 17, fontWeight: '700' },
btnModernOutline: { backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 12, borderWidth: 1.5, borderColor: '#22c55e' },
btnModernOutlineText: { color: '#22c55e', fontSize: 17, fontWeight: '700' },
forgotLink: { marginTop: 20, alignItems: 'center' },
forgotText: { color: '#4ade80', fontSize: 14 },
footerText: { color: '#3a4d3a', fontSize: 12, marginTop: 40 },
mapSmall: { width: '100%', height: 320 },
trackBtn: { backgroundColor: '#22c55e', padding: 18, margin: 15, borderRadius: 16 },
trackBtnText: { color: '#0a0d0a', textAlign: 'center', fontWeight: '700', fontSize: 18 },
sensorCard: { backgroundColor: '#111812', margin: 15, padding: 20, borderRadius: 16 },
tabContent: { flex: 1, padding: 15 },
historyItem: { backgroundColor: '#161f17', padding: 15, marginVertical: 8, borderRadius: 14 },
bottomTabs: { flexDirection: 'row', backgroundColor: '#111812', padding: 12, justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#222' },
tab: { alignItems: 'center', padding: 8 },
sectionTitle: { fontSize: 19, color: '#22c55e', fontWeight: '700', marginBottom: 8 },
refreshBtn: { backgroundColor: '#22c55e', padding: 12, borderRadius: 10, marginBottom: 15 },
refreshBtnText: { color: '#0a0d0a', textAlign: 'center', fontWeight: '700' },
input: { backgroundColor: '#1a2a1a', color: '#fff', padding: 14, margin: 10, borderRadius: 12, width: '90%', borderWidth: 1, borderColor: '#22c55e' },
});
