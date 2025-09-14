import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FileText, Search, Calendar, Euro, User, Phone, Eye, Filter, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { db } from '../../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptModal } from '../../components/dialogs/ReceiptModal';

interface Receipt {
  id: string;
  receiptNumber: string;
  parentName: string;
  parentContact: string;
  amount: number;
  date: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
}

export const Receipts: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchReceipts();
  }, []);

  useEffect(() => {
    filterReceipts();
  }, [receipts, searchQuery, dateFilter]);

  const fetchReceipts = async () => {
    setIsLoading(true);
    try {
      const receiptsQuery = query(
        collection(db, 'receipts'),
        orderBy('createdAt', 'desc')
      );
      
      const receiptsSnapshot = await getDocs(receiptsQuery);
      const receiptsList = receiptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Receipt[];

      setReceipts(receiptsList);
    } catch (error) {
      console.error('Errore nel recupero delle ricevute:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterReceipts = () => {
    let filtered = [...receipts];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(receipt =>
        receipt.parentName.toLowerCase().includes(query) ||
        receipt.parentContact.toLowerCase().includes(query) ||
        receipt.receiptNumber.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(receipt => {
        const receiptDate = new Date(receipt.date);
        return receiptDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredReceipts(filtered);
    setCurrentPage(1);
  };

  const openReceiptModal = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setIsReceiptModalOpen(true);
  };

  const closeReceiptModal = () => {
    setSelectedReceipt(null);
    setIsReceiptModalOpen(false);
  };

  // Pagination
  const totalPages = Math.ceil(filteredReceipts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReceipts = filteredReceipts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Statistics
  const totalAmount = filteredReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const totalReceipts = filteredReceipts.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Gestione Ricevute</h1>
                  <p className="text-blue-100 mt-1">Visualizza e gestisci tutte le ricevute emesse</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => window.location.href = '/admin/payments'}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all duration-200 flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Torna ai Pagamenti
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ricevute Totali</p>
                  <p className="text-3xl font-bold text-blue-600">{totalReceipts}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Importo Totale</p>
                  <p className="text-3xl font-bold text-green-600">€{totalAmount.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Euro className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Media per Ricevuta</p>
                  <p className="text-3xl font-bold text-purple-600">
                    €{totalReceipts > 0 ? (totalAmount / totalReceipts).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Cerca per nome, contatto o numero ricevuta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="date"
                  placeholder="Filtra per data"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('');
                }}
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                Cancella Filtri
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Receipts Table */}
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ricevute ({filteredReceipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedReceipts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Numero</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Data</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Genitore</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Contatto</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Importo</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {paginatedReceipts.map((receipt, index) => (
                        <motion.tr
                          key={receipt.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {receipt.receiptNumber}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-gray-600">
                            {format(receipt.date, 'dd/MM/yyyy', { locale: it })}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{receipt.parentName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">{receipt.parentContact}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-bold text-green-600">
                              €{receipt.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReceiptModal(receipt)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizza
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Nessuna ricevuta trovata</h3>
                <p className="text-gray-600">
                  {searchQuery || dateFilter 
                    ? 'Nessuna ricevuta corrisponde ai criteri di ricerca.'
                    : 'Non ci sono ricevute emesse.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Pagina {currentPage} di {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          isOpen={isReceiptModalOpen}
          onClose={closeReceiptModal}
        />
      )}
    </div>
  );
};
