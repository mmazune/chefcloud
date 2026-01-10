/**
 * M8.2: Journal Entries Page
 * 
 * Lists all journal entries with filtering and ability to create new entries.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Search, BookOpen, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I2: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/finance/journal',
  title: 'Journal Entries',
  primaryActions: [
    { label: 'Create Entry', testId: 'journal-create', intent: 'create' },
    { label: 'Post Entry', testId: 'journal-post', intent: 'update' },
    { label: 'Reverse Entry', testId: 'journal-reverse', intent: 'update' },
    { label: 'View Details', testId: 'journal-view', intent: 'view' },
  ],
  apiCalls: [
    { method: 'GET', path: '/accounting/journal-entries', trigger: 'onMount', notes: 'List entries' },
    { method: 'POST', path: '/accounting/journal-entries', trigger: 'onSubmit', notes: 'Create entry' },
    { method: 'POST', path: '/accounting/journal-entries/:id/post', trigger: 'onAction', notes: 'Post' },
    { method: 'POST', path: '/accounting/journal-entries/:id/reverse', trigger: 'onAction', notes: 'Reverse' },
  ],
  risk: 'HIGH',
  allowedRoles: ['OWNER', 'ACCOUNTANT'],
});

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JournalLine {
  id?: string;
  accountId: string;
  account?: Account;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  date: string;
  memo: string | null;
  source: string | null;
  sourceId: string | null;
  createdAt: string;
  lines: JournalLine[];
}

interface NewEntryLine {
  accountId: string;
  debit: string;
  credit: string;
}

export default function JournalEntriesPage() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const branchId = activeBranchId || user?.branch?.id;
  const showNewDialog = searchParams?.get('new') === 'true';

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(showNewDialog);
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    memo: '',
    lines: [
      { accountId: '', debit: '', credit: '' },
      { accountId: '', debit: '', credit: '' },
    ] as NewEntryLine[],
  });

  // Fetch journal entries
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['journal-entries', branchId],
    queryFn: async () => {
      const response = await apiClient.get<JournalEntry[]>('/accounting/journal', {
        params: { branchId },
      });
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await apiClient.get<Account[]>('/accounting/accounts');
      return response.data;
    },
    enabled: !!user,
  });

  // Create journal entry mutation
  const createEntry = useMutation({
    mutationFn: async (data: { date: string; memo: string; lines: Array<{ accountId: string; debit: number; credit: number }> }) => {
      const response = await apiClient.post('/accounting/journal', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Success', description: 'Journal entry created' });
      setIsDialogOpen(false);
      resetNewEntry();
      // Remove ?new=true from URL
      router.replace('/finance/journal', undefined, { shallow: true });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({ 
        title: 'Error', 
        description: error.response?.data?.message || 'Failed to create entry',
        variant: 'destructive' 
      });
    },
  });

  const resetNewEntry = () => {
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      memo: '',
      lines: [
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' },
      ],
    });
  };

  const addLine = () => {
    setNewEntry(prev => ({
      ...prev,
      lines: [...prev.lines, { accountId: '', debit: '', credit: '' }],
    }));
  };

  const removeLine = (index: number) => {
    if (newEntry.lines.length > 2) {
      setNewEntry(prev => ({
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index),
      }));
    }
  };

  const updateLine = (index: number, field: keyof NewEntryLine, value: string) => {
    setNewEntry(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => 
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const handleSubmit = () => {
    const lines = newEntry.lines
      .filter(l => l.accountId && (l.debit || l.credit))
      .map(l => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));

    if (lines.length < 2) {
      toast({ title: 'Error', description: 'At least 2 lines required', variant: 'destructive' });
      return;
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ 
        title: 'Error', 
        description: `Entry must be balanced. Debits: ${formatCurrency(totalDebit)}, Credits: ${formatCurrency(totalCredit)}`,
        variant: 'destructive' 
      });
      return;
    }

    createEntry.mutate({
      date: newEntry.date,
      memo: newEntry.memo,
      lines,
    });
  };

  // Calculate balance for preview
  const previewDebit = newEntry.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const previewCredit = newEntry.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(previewDebit - previewCredit) < 0.01;

  // Filter entries
  const filteredEntries = entries?.filter(entry => 
    entry.memo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.id.includes(searchTerm)
  ) || [];

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Journal Entries" 
          subtitle="View and create accounting journal entries"
        />

        {/* Actions Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by memo or source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="journal-create">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Journal Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Journal Entry</DialogTitle>
                    <DialogDescription>
                      Enter the details for the new journal entry. Debits must equal credits.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={newEntry.date}
                          onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="memo">Memo</Label>
                        <Input
                          id="memo"
                          placeholder="Description of the entry"
                          value={newEntry.memo}
                          onChange={(e) => setNewEntry(prev => ({ ...prev, memo: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Lines</Label>
                      <div className="space-y-2 mt-2">
                        {newEntry.lines.map((line, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Select
                              value={line.accountId}
                              onValueChange={(value) => updateLine(index, 'accountId', value)}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts?.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.code} - {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Debit"
                              type="number"
                              step="0.01"
                              className="w-32"
                              value={line.debit}
                              onChange={(e) => updateLine(index, 'debit', e.target.value)}
                            />
                            <Input
                              placeholder="Credit"
                              type="number"
                              step="0.01"
                              className="w-32"
                              value={line.credit}
                              onChange={(e) => updateLine(index, 'credit', e.target.value)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(index)}
                              disabled={newEntry.lines.length <= 2}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-2" onClick={addLine}>
                        Add Line
                      </Button>
                    </div>

                    {/* Balance Preview */}
                    <div className={`p-3 rounded-md ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                      <div className="flex justify-between text-sm">
                        <span>Total Debits: {formatCurrency(previewDebit)}</span>
                        <span>Total Credits: {formatCurrency(previewCredit)}</span>
                        <Badge variant={isBalanced ? 'default' : 'destructive'}>
                          {isBalanced ? 'Balanced' : `Difference: ${formatCurrency(Math.abs(previewDebit - previewCredit))}`}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      data-testid="journal-submit"
                      onClick={handleSubmit} 
                      disabled={!isBalanced || createEntry.isPending}
                    >
                      {createEntry.isPending ? 'Creating...' : 'Create Entry'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Journal Entries ({filteredEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEntries && <p className="text-muted-foreground">Loading entries...</p>}
            {!loadingEntries && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="w-[80px]">Lines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No journal entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => {
                      const totalDebit = entry.lines?.reduce((sum, l) => sum + Number(l.debit), 0) || 0;
                      const totalCredit = entry.lines?.reduce((sum, l) => sum + Number(l.credit), 0) || 0;
                      return (
                        <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-mono">
                            {new Date(entry.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{entry.memo || '—'}</TableCell>
                          <TableCell>
                            {entry.source ? (
                              <Badge variant="outline">{entry.source}</Badge>
                            ) : (
                              <span className="text-muted-foreground">Manual</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(totalDebit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(totalCredit)}
                          </TableCell>
                          <TableCell className="text-center">
                            {entry.lines?.length || 0}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: GET /accounting/journal, POST /accounting/journal
          {branchId && ` • Branch filter: ${branchId}`}
        </div>
      </AppShell>
    </RequireRole>
  );
}
