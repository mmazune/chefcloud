import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_BASE_URL = 'http://localhost:4000';

interface AnomalyEvent {
  id: string;
  type: string;
  severity: string;
  description: string;
  createdAt: string;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      // Fetch latest 50 anomaly events
      const response = await fetch(`${API_BASE_URL}/analytics/anomalies?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 401) {
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      setAlerts(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'HIGH':
        return '#E53935';
      case 'MEDIUM':
        return '#FB8C00';
      case 'LOW':
        return '#FDD835';
      default:
        return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0033FF" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchAlerts}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Anomaly Alerts</Text>
        <TouchableOpacity onPress={fetchAlerts}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No alerts found</Text>
          <Text style={styles.emptySubtext}>All clear! 🎉</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {alerts.map(alert => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={styles.alertType}>
                  <View
                    style={[
                      styles.severityDot,
                      { backgroundColor: getSeverityColor(alert.severity) },
                    ]}
                  />
                  <Text style={styles.typeText}>{alert.type.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.timeText}>{formatDate(alert.createdAt)}</Text>
              </View>
              <Text style={styles.descriptionText}>{alert.description}</Text>
              <Text style={styles.severityText}>Severity: {alert.severity}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAEDF3',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EAEDF3',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00033D',
  },
  refreshText: {
    color: '#0033FF',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  alertCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00033D',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  severityText: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00033D',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#E53935',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0033FF',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    height: 20,
  },
});
