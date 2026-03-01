import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface SpecializationCount {
  [key: string]: number;
}

interface TeamMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  specializations: string[];
  coordinate?: { lat: number; lng: number };
  preferredLocation?: string;
  availableOnline: boolean;
  verified: boolean;
  active: boolean;
  lastActive?: Date;
  canWorkAnywhere?: boolean;
  whatsapp?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  completedProjectCount?: number;
}

interface TeamData {
  id: string;
  name: string;
  description: string;
  members: string[];
  adminIds: string[];
  specializations: string[];
  coordinate?: { lat: number; lng: number };
  indirizzo?: string;
  raggioKm?: number;
  teamImage?: string;
  verified: boolean;
  rating?: number;
  completedProjects?: number;
  createdAt?: Date;
}

interface UserProfile {
  profile: {
    specializations?: string[];
    coordinate?: { lat: number; lng: number };
    preferredLocation?: string;
    availableOnline?: boolean;
    verified?: boolean;
    active?: boolean;
    lastActive?: Date;
    canWorkAnywhere?: boolean;
    whatsapp?: string;
    phone?: string;
    rating?: number;
    reviewCount?: number;
    completedProjectCount?: number;
  };
}

// Utility function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Standardize specialization names
function normalizeSpecialization(spec: string): string {
  const normalizationMap: { [key: string]: string } = {
    'medico': 'Medico',
    'psicologo': 'Psicologo',
    'nutrizionista': 'Nutrizionista',
    'farmacista': 'Farmacista',
    'odontoiatra': 'Odontoiatra',
    'veterinario': 'Veterinario',
    'ostetrica': 'Ostetrica',
    'logopedista': 'Logopedista',
    'tecnico di laboratorio': 'Tecnico di Laboratorio',
    'operatore socio sanitario': 'Operatore Socio Sanitario',
    'biologo': 'Biologo',
    'terapista della riabilitazione': 'Terapista della Riabilitazione',
    'radiologo': 'Radiologo',
    'anestesista': 'Anestesista',
    'chirurgo': 'Chirurgo',
    'cardiologo': 'Cardiologo',
    'neurologo': 'Neurologo',
    'pediatra': 'Pediatra',
    'dermatologo': 'Dermatologo',
    'urologo': 'Urologo',
    'oculista': 'Oculista',
    'otorinolaringoiatra': 'Otorinolaringoiatra',
    'ortopedico': 'Ortopedico',
    'gastroenterologo': 'Gastroenterologo',
    'endocrinologo': 'Endocrinologo',
    'pneumologo': 'Pneumologo',
    'oncologo': 'Oncologo',
    'psichiatra': 'Psichiatra',
    'nefrologo': 'Nefrologo',
    'ematologo': 'Ematologo',
    'reumatologo': 'Reumatologo',
    'allergologo': 'Allergologo',
    'infettivologo': 'Infettivologo',
    'medicina del lavoro': 'Medicina del Lavoro',
    'medicina legale': 'Medicina Legale',
    'igiene e sanità pubblica': 'Igiene e Sanità Pubblica',
    'medicina d\'urgenza': 'Medicina d\'Urgenza',
    'geriatria': 'Geriatria',
    'patologia clinica': 'Patologia Clinica',
    'medicina nucleare': 'Medicina Nucleare',
    'radioterapia': 'Radioterapia',
    'medicina fisica e riabilitazione': 'Medicina Fisica e Riabilitazione',
    'medicina dello sport': 'Medicina dello Sport',
    'medicina termale': 'Medicina Termale'
  };
  
  return normalizationMap[spec.toLowerCase()] || spec;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [professionals, setProfessionals] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [distanceFilter, setDistanceFilter] = useState<number>(50);
  const [onlineFilter, setOnlineFilter] = useState<boolean>(false);
  const [verifiedFilter, setVerifiedFilter] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'professionals' | 'teams'>('professionals');
  const [specializationCounts, setSpecializationCounts] = useState<SpecializationCount>({});
  const [userCoordinate, setUserCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'activity' | 'projects'>('distance');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get user's coordinates for distance calculations
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        if (userData.profile?.coordinate) {
          setUserCoordinate(userData.profile.coordinate);
        }
      }
      
      // Load professionals
      const professionalsQuery = query(
        collection(db, 'users'),
        where('profile.verified', '==', true),
        where('profile.active', '==', true)
      );
      const professionalsSnapshot = await getDocs(professionalsQuery);
      
      const professionalsList: TeamMember[] = [];
      const specCounts: SpecializationCount = {};
      
      professionalsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.profile && doc.id !== user.uid) {
          const member: TeamMember = {
            uid: doc.id,
            displayName: data.displayName || data.email || 'Professional',
            email: data.email || '',
            photoURL: data.photoURL || data.profile.photoURL,
            specializations: (data.profile.specializations || []).map(normalizeSpecialization),
            coordinate: data.profile.coordinate,
            preferredLocation: data.profile.preferredLocation,
            availableOnline: data.profile.availableOnline || false,
            verified: data.profile.verified || false,
            active: data.profile.active || false,
            lastActive: data.profile.lastActive?.toDate(),
            canWorkAnywhere: data.profile.canWorkAnywhere || false,
            whatsapp: data.profile.whatsapp,
            phone: data.profile.phone,
            rating: data.profile.rating || 0,
            reviewCount: data.profile.reviewCount || 0,
            completedProjectCount: data.profile.completedProjectCount || 0,
          };
          
          professionalsList.push(member);
          
          // Count specializations
          member.specializations.forEach(spec => {
            specCounts[spec] = (specCounts[spec] || 0) + 1;
          });
        }
      });
      
      setProfessionals(professionalsList);
      setSpecializationCounts(specCounts);
      
      // Load teams
      const teamsQuery = query(
        collection(db, 'teams'),
        where('verified', '==', true)
      );
      const teamsSnapshot = await getDocs(teamsQuery);
      
      const teamsList: TeamData[] = [];
      teamsSnapshot.forEach((doc) => {
        const data = doc.data();
        teamsList.push({
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          members: data.members || [],
          adminIds: data.adminIds || [],
          specializations: (data.specializations || []).map(normalizeSpecialization),
          coordinate: data.coordinate,
          indirizzo: data.indirizzo,
          raggioKm: data.raggioKm,
          teamImage: data.teamImage,
          verified: data.verified || false,
          rating: data.rating || 0,
          completedProjects: data.completedProjects || 0,
          createdAt: data.createdAt?.toDate(),
        });
      });
      
      setTeams(teamsList);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfessionals = professionals.filter(professional => {
    // Search term filter
    if (searchTerm && !professional.displayName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !professional.specializations.some(spec => spec.toLowerCase().includes(searchTerm.toLowerCase()))) {
      return false;
    }
    
    // Specialization filter
    if (selectedSpecialization && !professional.specializations.includes(selectedSpecialization)) {
      return false;
    }
    
    // Location filter
    if (locationFilter && professional.preferredLocation && 
        !professional.preferredLocation.toLowerCase().includes(locationFilter.toLowerCase())) {
      return false;
    }
    
    // Online filter
    if (onlineFilter && !professional.availableOnline) {
      return false;
    }
    
    // Verified filter
    if (verifiedFilter && !professional.verified) {
      return false;
    }
    
    // Distance filter
    if (userCoordinate && professional.coordinate && !professional.canWorkAnywhere) {
      const distance = calculateDistance(
        userCoordinate.lat, userCoordinate.lng,
        professional.coordinate.lat, professional.coordinate.lng
      );
      if (distance > distanceFilter) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'activity':
        if (!a.lastActive && !b.lastActive) return 0;
        if (!a.lastActive) return 1;
        if (!b.lastActive) return -1;
        return b.lastActive.getTime() - a.lastActive.getTime();
      case 'projects':
        return (b.completedProjectCount || 0) - (a.completedProjectCount || 0);
      case 'distance':
      default:
        if (!userCoordinate || (!a.coordinate && !b.coordinate)) return 0;
        if (!a.coordinate) return 1;
        if (!b.coordinate) return -1;
        
        const distanceA = calculateDistance(
          userCoordinate.lat, userCoordinate.lng,
          a.coordinate.lat, a.coordinate.lng
        );
        const distanceB = calculateDistance(
          userCoordinate.lat, userCoordinate.lng,
          b.coordinate.lat, b.coordinate.lng
        );
        
        return distanceA - distanceB;
    }
  });

  const filteredTeams = teams.filter(team => {
    // Search term filter
    if (searchTerm && !team.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !team.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !team.specializations.some(spec => spec.toLowerCase().includes(searchTerm.toLowerCase()))) {
      return false;
    }
    
    // Specialization filter
    if (selectedSpecialization && !team.specializations.includes(selectedSpecialization)) {
      return false;
    }
    
    // Location filter
    if (locationFilter && team.indirizzo && 
        !team.indirizzo.toLowerCase().includes(locationFilter.toLowerCase())) {
      return false;
    }
    
    // Distance filter
    if (userCoordinate && team.coordinate) {
      const distance = calculateDistance(
        userCoordinate.lat, userCoordinate.lng,
        team.coordinate.lat, team.coordinate.lng
      );
      if (distance > distanceFilter) {
        return false;
      }
    }
    
    return true;
  });

  const getDistanceText = (coordinate: { lat: number; lng: number } | undefined): string => {
    if (!userCoordinate || !coordinate) return '';
    
    const distance = calculateDistance(
      userCoordinate.lat, userCoordinate.lng,
      coordinate.lat, coordinate.lng
    );
    
    return `${distance.toFixed(1)} km`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Trova professionisti e team sanitari nella tua zona</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Cerca
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome o specializzazione..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Specialization */}
            <div>
              <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">
                Specializzazione
              </label>
              <select
                id="specialization"
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutte</option>
                {Object.entries(specializationCounts).map(([spec, count]) => (
                  <option key={spec} value={spec}>
                    {spec} ({count})
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Località
              </label>
              <input
                type="text"
                id="location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Inserisci città..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Distance */}
            <div>
              <label htmlFor="distance" className="block text-sm font-medium text-gray-700 mb-1">
                Distanza max: {distanceFilter} km
              </label>
              <input
                type="range"
                id="distance"
                min="5"
                max="200"
                step="5"
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Additional filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={onlineFilter}
                onChange={(e) => setOnlineFilter(e.target.checked)}
                className="mr-2"
              />
              Solo online
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={verifiedFilter}
                onChange={(e) => setVerifiedFilter(e.target.checked)}
                className="mr-2"
              />
              Solo verificati
            </label>
          </div>

          {/* Sort options */}
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Ordina per:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="distance">Distanza</option>
              <option value="rating">Valutazione</option>
              <option value="activity">Ultima attività</option>
              <option value="projects">Progetti completati</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('professionals')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'professionals'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Professionisti ({filteredProfessionals.length})
              </button>
              <button
                onClick={() => setActiveTab('teams')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'teams'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Team ({filteredTeams.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'professionals' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfessionals.map((professional) => (
              <div key={professional.uid} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {professional.photoURL && (
                      <img
                        src={professional.photoURL}
                        alt={professional.displayName}
                        className="w-12 h-12 rounded-full mr-3 object-cover"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{professional.displayName}</h3>
                      <div className="flex items-center">
                        {professional.verified && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                            ✓ Verificato
                          </span>
                        )}
                        {professional.availableOnline && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            🌐 Online
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {professional.specializations.slice(0, 3).map((spec, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {spec}
                        </span>
                      ))}
                      {professional.specializations.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          +{professional.specializations.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {professional.preferredLocation && (
                    <p className="text-sm text-gray-600 mb-2">
                      📍 {professional.preferredLocation}
                      {professional.coordinate && (
                        <span className="ml-2 text-blue-600">
                          ({getDistanceText(professional.coordinate)})
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <div className="flex items-center">
                      ⭐ {professional.rating?.toFixed(1) || 'N/A'}
                      <span className="ml-1">({professional.reviewCount || 0})</span>
                    </div>
                    <div>
                      🏆 {professional.completedProjectCount || 0} progetti
                    </div>
                  </div>

                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => navigate(`/profile/${professional.uid}`)}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Visualizza Profilo
                    </button>
                    {professional.whatsapp && (
                      <a
                        href={`https://wa.me/${professional.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-600 transition-colors"
                      >
                        📱
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <div key={team.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {team.teamImage && (
                  <img
                    src={team.teamImage}
                    alt={team.name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                    {team.verified && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Verificato
                      </span>
                    )}
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{team.description}</p>

                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {team.specializations.slice(0, 3).map((spec, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {spec}
                        </span>
                      ))}
                      {team.specializations.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          +{team.specializations.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {team.indirizzo && (
                    <p className="text-sm text-gray-600 mb-2">
                      📍 {team.indirizzo}
                      {team.coordinate && (
                        <span className="ml-2 text-blue-600">
                          ({getDistanceText(team.coordinate)})
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      ⭐ {team.rating?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="flex items-center">
                      👥 {team.members.length} membri
                    </div>
                    <div>
                      🏆 {team.completedProjects || 0} progetti
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/teams/${team.id}`)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Visualizza Team
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(filteredProfessionals.length === 0 && activeTab === 'professionals') && (
          <div className="text-center py-8">
            <p className="text-gray-500">Nessun professionista trovato con i filtri selezionati.</p>
          </div>
        )}

        {(filteredTeams.length === 0 && activeTab === 'teams') && (
          <div className="text-center py-8">
            <p className="text-gray-500">Nessun team trovato con i filtri selezionati.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
