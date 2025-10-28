import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:4000';

interface KPIData {
  salesToday: number;
  sales7d: number;
  topItems: Array<{ menuItemId: string; name: string; quantity: number; revenue: number }>;
  paymentBreakdown: Array<{ method: string; amount: number; count: number }>;
  anomaliesToday: number;
}

export default function Dashboard() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchKPIs = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/owner/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch KPIs');
      }

      const kpis = await response.json();
      setData(kpis);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0033FF" />
        <Text style={styles.loadingText}>Loading KPIs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchKPIs}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No data available</Text>
      </View>
    );
  }

  const momoTotal = data.paymentBreakdown.find((p) => p.method === 'MOMO')?.amount || 0;
  const cashTotal = data.paymentBreakdown.find((p) => p.method === 'CASH')?.amount || 0;
  const total = momoTotal + cashTotal;
  const momoPercent = total > 0 ? ((momoTotal / total) * 100).toFixed(1) : '0';
  const cashPercent = total > 0 ? ((cashTotal / total) * 100).toFixed(1) : '0';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sales Overview</Text>
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Today</Text>
            <Text style={styles.metricValue}>${data.salesToday.toFixed(2)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>7 Days</Text>
            <Text style={styles.metricValue}>${data.sales7d.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Breakdown</Text>
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>MOMO</Text>
            <Text style={styles.metricValue}>${momoTotal.toFixed(2)}</Text>
            <Text style={styles.metricSubtext}>{momoPercent}%</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>CASH</Text>
            <Text style={styles.metricValue}>${cashTotal.toFixed(2)}</Text>
            <Text style={styles.metricSubtext}>{cashPercent}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Items</Text>
        {data.topItems.slice(0, 5).map((item, idx) => (
          <View key={item.menuItemId} style={styles.listItem}>
            <Text style={styles.itemName}>
              {idx + 1}. {item.name}
            </Text>
            <Text style={styles.itemValue}>
              {item.quantity} sold · ${item.revenue.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Alerts</Text>
        <Text style={styles.alertText}>{data.anomaliesToday} anomalies today</Text>
      </View>

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
  logoutText: {
    color: '#0033FF',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00033D',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00033D',
  },
  metricSubtext: {
    fontSize: 12,
    color: '#0033FF',
    marginTop: 2,
  },
  listItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#00033D',
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 12,
    color: '#666',
  },
  alertText: {
    fontSize: 16,
    color: '#00033D',
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
