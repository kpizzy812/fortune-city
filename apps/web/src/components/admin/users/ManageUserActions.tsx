'use client';

import { useState } from 'react';
import {
  DollarSign,
  Users,
  Gift,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAdminUsersStore } from '@/stores/admin/admin-users.store';
import type { AdminUserDetail } from '@/lib/api';

interface ManageUserActionsProps {
  user: AdminUserDetail;
}

export function ManageUserActions({ user }: ManageUserActionsProps) {
  const {
    adjustBalance,
    updateReferrer,
    updateFreeSpins,
    addMachine,
    deleteMachine,
    extendMachineLifespan,
    isLoadingUser,
  } = useAdminUsersStore();

  // Balance management
  const [balanceOperation, setBalanceOperation] = useState<'add' | 'subtract' | 'set'>('add');
  const [fortuneAmount, setFortuneAmount] = useState('');
  const [referralAmount, setReferralAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');

  // Referrer management
  const [newReferrerId, setNewReferrerId] = useState('');

  // Free spins management
  const [freeSpins, setFreeSpins] = useState(user.freeSpinsRemaining.toString());

  // Machine management
  const [machineTier, setMachineTier] = useState('1');
  const [machineReinvestRound, setMachineReinvestRound] = useState('1');
  const [machineReason, setMachineReason] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [extendDays, setExtendDays] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const handleAdjustBalance = async () => {
    try {
      const fortuneValue = fortuneAmount ? parseFloat(fortuneAmount) : undefined;
      const referralValue = referralAmount ? parseFloat(referralAmount) : undefined;

      if (!fortuneValue && !referralValue) {
        showError('Введите хотя бы одну сумму');
        return;
      }

      await adjustBalance(
        user.id,
        balanceOperation,
        fortuneValue,
        referralValue,
        balanceReason || undefined,
      );

      setFortuneAmount('');
      setReferralAmount('');
      setBalanceReason('');
      showSuccess('Баланс успешно обновлен');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Ошибка обновления баланса');
    }
  };

  const handleUpdateReferrer = async () => {
    try {
      await updateReferrer(user.id, newReferrerId || null);
      setNewReferrerId('');
      showSuccess('Пригласитель успешно обновлен');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Ошибка обновления пригласителя');
    }
  };

  const handleUpdateFreeSpins = async () => {
    try {
      const spins = parseInt(freeSpins);
      if (isNaN(spins) || spins < 0) {
        showError('Введите корректное количество фриспинов');
        return;
      }

      await updateFreeSpins(user.id, spins);
      showSuccess('Фриспины успешно обновлены');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Ошибка обновления фриспинов');
    }
  };

  const handleAddMachine = async () => {
    try {
      const tier = parseInt(machineTier);
      const reinvestRound = parseInt(machineReinvestRound);

      if (isNaN(tier) || tier < 1 || tier > 10) {
        showError('Tier должен быть от 1 до 10');
        return;
      }

      await addMachine(user.id, tier, reinvestRound, machineReason || undefined);

      setMachineTier('1');
      setMachineReinvestRound('1');
      setMachineReason('');
      showSuccess('Машина успешно добавлена');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Ошибка добавления машины');
    }
  };

  const handleDeleteMachine = async () => {
    if (!selectedMachineId) {
      showError('Выберите машину');
      return;
    }

    try {
      await deleteMachine(user.id, selectedMachineId, deleteReason || undefined);
      setSelectedMachineId('');
      setDeleteReason('');
      showSuccess('Машина успешно удалена');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Ошибка удаления машины');
    }
  };

  const handleExtendMachine = async () => {
    if (!selectedMachineId) {
      showError('Выберите машину');
      return;
    }

    const days = parseInt(extendDays);
    if (isNaN(days) || days < 1) {
      showError('Введите корректное количество дней');
      return;
    }

    try {
      await extendMachineLifespan(user.id, selectedMachineId, days, extendReason || undefined);
      setSelectedMachineId('');
      setExtendDays('');
      setExtendReason('');
      showSuccess('Срок машины успешно продлен');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Ошибка продления машины');
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <p className="text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Balance Management */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Управление балансом</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Операция</label>
            <select
              value={balanceOperation}
              onChange={(e) => setBalanceOperation(e.target.value as 'add' | 'subtract' | 'set')}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
            >
              <option value="add">Добавить</option>
              <option value="subtract">Вычесть</option>
              <option value="set">Установить</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Fortune Balance</label>
              <input
                type="number"
                step="0.01"
                value={fortuneAmount}
                onChange={(e) => setFortuneAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Referral Balance</label>
              <input
                type="number"
                step="0.01"
                value={referralAmount}
                onChange={(e) => setReferralAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Причина (опционально)</label>
            <input
              type="text"
              value={balanceReason}
              onChange={(e) => setBalanceReason(e.target.value)}
              placeholder="Компенсация, подарок и т.д."
              maxLength={500}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={handleAdjustBalance}
            disabled={isLoadingUser}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
          >
            {isLoadingUser ? 'Обновление...' : 'Обновить баланс'}
          </button>
        </div>
      </div>

      {/* Referrer & Free Spins Management */}
      <div className="grid grid-cols-2 gap-4">
        {/* Referrer */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Пригласитель</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">User ID пригласителя</label>
              <input
                type="text"
                value={newReferrerId}
                onChange={(e) => setNewReferrerId(e.target.value)}
                placeholder={user.referrer?.id || 'Не указан'}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Оставьте пустым для удаления</p>
            </div>

            <button
              onClick={handleUpdateReferrer}
              disabled={isLoadingUser}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {isLoadingUser ? 'Обновление...' : 'Обновить'}
            </button>
          </div>
        </div>

        {/* Free Spins */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Фриспины</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Количество</label>
              <input
                type="number"
                value={freeSpins}
                onChange={(e) => setFreeSpins(e.target.value)}
                min="0"
                max="1000"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={handleUpdateFreeSpins}
              disabled={isLoadingUser}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {isLoadingUser ? 'Обновление...' : 'Обновить'}
            </button>
          </div>
        </div>
      </div>

      {/* Machine Management */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Управление машинами</h3>
        </div>

        <div className="space-y-6">
          {/* Add Machine */}
          <div className="pb-6 border-b border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Добавить машину</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Tier (1-10)</label>
                <input
                  type="number"
                  value={machineTier}
                  onChange={(e) => setMachineTier(e.target.value)}
                  min="1"
                  max="10"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Reinvest Round</label>
                <input
                  type="number"
                  value={machineReinvestRound}
                  onChange={(e) => setMachineReinvestRound(e.target.value)}
                  min="1"
                  max="7"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Причина</label>
              <input
                type="text"
                value={machineReason}
                onChange={(e) => setMachineReason(e.target.value)}
                placeholder="Компенсация, подарок и т.д."
                maxLength={500}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <button
              onClick={handleAddMachine}
              disabled={isLoadingUser}
              className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {isLoadingUser ? 'Добавление...' : 'Добавить машину'}
            </button>
          </div>

          {/* Machine Selector */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Выбрать машину</label>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 mb-4"
            >
              <option value="">-- Выберите машину --</option>
              {/* Machine list будет заполнен из данных пользователя */}
              <option value="placeholder">Tier X Machine (в разработке)</option>
            </select>
          </div>

          {/* Extend Machine */}
          <div className="pb-6 border-b border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Продлить срок
            </h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Дней</label>
                <input
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  min="1"
                  max="365"
                  placeholder="1-365"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Причина</label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Компенсация"
                  maxLength={500}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleExtendMachine}
              disabled={isLoadingUser || !selectedMachineId}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {isLoadingUser ? 'Продление...' : 'Продлить срок'}
            </button>
          </div>

          {/* Delete Machine */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Удалить машину
            </h4>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Причина</label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Причина удаления"
                maxLength={500}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <button
              onClick={handleDeleteMachine}
              disabled={isLoadingUser || !selectedMachineId}
              className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {isLoadingUser ? 'Удаление...' : 'Удалить машину'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
