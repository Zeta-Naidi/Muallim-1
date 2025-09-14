import React from 'react';
import { X, Download, Printer, Calendar, Euro, User, Phone, FileText, Building } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

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

interface ReceiptModalProps {
  receipt: Receipt;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  isOpen,
  onClose
}) => {
  const handlePrint = () => {
    const printContent = document.getElementById('receipt-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Ricevuta ${receipt.receiptNumber}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .receipt-header { text-align: center; margin-bottom: 30px; }
                .receipt-body { margin: 20px 0; }
                .receipt-row { display: flex; justify-content: space-between; margin: 10px 0; }
                .receipt-label { font-weight: bold; }
                .receipt-amount { font-size: 24px; font-weight: bold; color: #059669; }
                .receipt-footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
                @media print {
                  body { margin: 0; }
                  .no-print { display: none; }
                }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownloadPDF = () => {
    const printContent = document.getElementById('receipt-pdf-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Ricevuta ${receipt.receiptNumber}</title>
              <meta charset="UTF-8">
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background: white;
                  padding: 40px;
                }
                .receipt-container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  border: 2px solid #e5e7eb;
                  border-radius: 12px;
                  overflow: hidden;
                }
                .receipt-header {
                  background: linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  position: relative;
                }
                .receipt-header::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: rgba(0,0,0,0.1);
                }
                .receipt-header-content {
                  position: relative;
                  z-index: 1;
                }
                .school-logo {
                  width: 60px;
                  height: 60px;
                  background: rgba(255,255,255,0.2);
                  border-radius: 50%;
                  margin: 0 auto 15px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 24px;
                  font-weight: bold;
                }
                .school-name {
                  font-size: 28px;
                  font-weight: bold;
                  margin-bottom: 8px;
                }
                .receipt-title {
                  font-size: 18px;
                  opacity: 0.9;
                  margin-bottom: 15px;
                }
                .receipt-number {
                  background: rgba(255,255,255,0.2);
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-size: 14px;
                  display: inline-block;
                }
                .receipt-body {
                  padding: 40px;
                }
                .info-section {
                  margin-bottom: 30px;
                }
                .section-title {
                  font-size: 16px;
                  font-weight: bold;
                  color: #374151;
                  margin-bottom: 15px;
                  padding-bottom: 8px;
                  border-bottom: 2px solid #e5e7eb;
                }
                .info-row {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 12px 0;
                  border-bottom: 1px solid #f3f4f6;
                }
                .info-row:last-child {
                  border-bottom: none;
                }
                .info-label {
                  font-weight: 600;
                  color: #6b7280;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                }
                .info-value {
                  font-weight: 500;
                  color: #111827;
                }
                .amount-section {
                  background: linear-gradient(135deg, #10b981, #059669);
                  color: white;
                  padding: 25px;
                  border-radius: 12px;
                  text-align: center;
                  margin: 30px 0;
                  position: relative;
                  overflow: hidden;
                }
                .amount-section::before {
                  content: '';
                  position: absolute;
                  top: -50%;
                  left: -50%;
                  width: 200%;
                  height: 200%;
                  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                }
                .amount-label {
                  font-size: 16px;
                  opacity: 0.9;
                  margin-bottom: 10px;
                  position: relative;
                  z-index: 1;
                }
                .amount-value {
                  font-size: 36px;
                  font-weight: bold;
                  position: relative;
                  z-index: 1;
                }
                .notes-section {
                  background: #f9fafb;
                  padding: 20px;
                  border-radius: 8px;
                  border-left: 4px solid #3b82f6;
                }
                .receipt-footer {
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 2px solid #e5e7eb;
                  text-align: center;
                  color: #6b7280;
                  font-size: 12px;
                }
                .footer-line {
                  margin: 5px 0;
                }
                .icon {
                  width: 16px;
                  height: 16px;
                  display: inline-block;
                }
                @media print {
                  body {
                    padding: 0;
                    background: white;
                  }
                  .receipt-container {
                    border: none;
                    box-shadow: none;
                  }
                }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        
        // Wait for content to load then trigger print dialog
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Ricevuta di Pagamento</h2>
                <p className="text-sm text-gray-500">Numero: {receipt.receiptNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="text-blue-600 hover:text-blue-700"
              >
                <Printer className="h-4 w-4 mr-2" />
                Stampa
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="text-green-600 hover:text-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Scarica PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <div id="receipt-content" className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Building className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Scuola Araba Muallim</h1>
            </div>
            <h2 className="text-lg font-semibold text-gray-700">Ricevuta di Pagamento</h2>
            <p className="text-sm text-gray-500 mt-2">Numero: {receipt.receiptNumber}</p>
          </div>

          {/* Receipt Details */}
          <div className="space-y-6">
            {/* Date */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-gray-700">Data Pagamento</span>
              </div>
              <span className="text-gray-900">
                {format(receipt.date, 'dd MMMM yyyy', { locale: it })}
              </span>
            </div>

            {/* Parent Details */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Dati Genitore
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-700">Nome</span>
                </div>
                <span className="text-gray-900">{receipt.parentName}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-700">Contatto</span>
                </div>
                <span className="text-gray-900">{receipt.parentContact}</span>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="bg-green-50 rounded-lg p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Euro className="h-6 w-6 text-green-600" />
                <span className="text-lg font-medium text-gray-700">Importo Pagato</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                €{receipt.amount.toFixed(2)}
              </div>
            </div>

            {/* Notes */}
            {receipt.notes && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Note</h3>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">
                  {receipt.notes}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
              <p>Ricevuta emessa il {format(receipt.createdAt, 'dd/MM/yyyy HH:mm', { locale: it })}</p>
              <p className="mt-1">Scuola Araba Muallim - Sistema di Gestione Pagamenti</p>
            </div>
          </div>
        </div>

        {/* Hidden PDF Template */}
        <div id="receipt-pdf-content" style={{ display: 'none' }}>
          <div className="receipt-container">
            <div className="receipt-header">
              <div className="receipt-header-content">
                <div className="school-logo">🏫</div>
                <div className="school-name">Scuola Araba Muallim</div>
                <div className="receipt-title">Ricevuta di Pagamento</div>
                <div className="receipt-number">N° {receipt.receiptNumber}</div>
              </div>
            </div>
            
            <div className="receipt-body">
              <div className="info-section">
                <div className="section-title">📅 Informazioni Pagamento</div>
                <div className="info-row">
                  <div className="info-label">Data Pagamento</div>
                  <div className="info-value">{format(receipt.date, 'dd MMMM yyyy', { locale: it })}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Data Emissione</div>
                  <div className="info-value">{format(receipt.createdAt, 'dd/MM/yyyy HH:mm', { locale: it })}</div>
                </div>
              </div>

              <div className="info-section">
                <div className="section-title">👤 Dati Genitore</div>
                <div className="info-row">
                  <div className="info-label">Nome Completo</div>
                  <div className="info-value">{receipt.parentName}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Contatto</div>
                  <div className="info-value">{receipt.parentContact}</div>
                </div>
              </div>

              <div className="amount-section">
                <div className="amount-label">💰 Importo Pagato</div>
                <div className="amount-value">€{receipt.amount.toFixed(2)}</div>
              </div>

              {receipt.notes && (
                <div className="info-section">
                  <div className="section-title">📝 Note</div>
                  <div className="notes-section">
                    {receipt.notes}
                  </div>
                </div>
              )}

              <div className="receipt-footer">
                <div className="footer-line">✅ Pagamento ricevuto e registrato nel sistema</div>
                <div className="footer-line">📧 Per informazioni: info@scuolaarabamuallim.it</div>
                <div className="footer-line">🏫 Scuola Araba Muallim - Sistema di Gestione Pagamenti</div>
                <div className="footer-line" style={{ marginTop: '15px', fontWeight: 'bold' }}>Grazie per la fiducia!</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
