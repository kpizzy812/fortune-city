'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  User,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { useAdminUsersStore } from '@/stores/admin/admin-users.store';
import type { ReferralTreeNode } from '@/lib/api';

interface ReferralTreeProps {
  userId: string;
}

export function ReferralTree({ userId }: ReferralTreeProps) {
  const {
    referralTree,
    isLoadingTree,
    error,
    fetchReferralTree,
    clearReferralTree,
  } = useAdminUsersStore();

  useEffect(() => {
    fetchReferralTree(userId);
    return () => clearReferralTree();
  }, [userId, fetchReferralTree, clearReferralTree]);

  const formatBalance = (balance: number) => {
    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (isLoadingTree) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!referralTree) {
    return null;
  }

  const totalReferrals =
    referralTree.stats.level1Count +
    referralTree.stats.level2Count +
    referralTree.stats.level3Count;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-sm text-slate-400">Level 1</p>
          <p className="text-2xl font-bold text-blue-400">
            {referralTree.stats.level1Count}
          </p>
          <p className="text-xs text-slate-500">5% rate</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-sm text-slate-400">Level 2</p>
          <p className="text-2xl font-bold text-purple-400">
            {referralTree.stats.level2Count}
          </p>
          <p className="text-xs text-slate-500">3% rate</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-sm text-slate-400">Level 3</p>
          <p className="text-2xl font-bold text-pink-400">
            {referralTree.stats.level3Count}
          </p>
          <p className="text-xs text-slate-500">1% rate</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-sm text-slate-400">Total Earned</p>
          <p className="text-2xl font-bold text-amber-400">
            ${formatBalance(referralTree.stats.totalEarned)}
          </p>
          <p className="text-xs text-slate-500">{totalReferrals} total</p>
        </div>
      </div>

      {/* Tree */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Referral Tree</h3>
          <p className="text-sm text-slate-400">
            3 levels deep from {referralTree.user.username || referralTree.user.referralCode}
          </p>
        </div>

        <div className="p-4">
          {referralTree.tree.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No referrals found
            </div>
          ) : (
            <div className="space-y-2">
              {referralTree.tree.map((node) => (
                <TreeNode key={node.id} node={node} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: ReferralTreeNode;
  depth?: number;
}

function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;

  const formatBalance = (balance: number) => {
    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 2:
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 3:
        return 'text-pink-400 bg-pink-500/10 border-pink-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getUserDisplayName = () => {
    if (node.username) return `@${node.username}`;
    if (node.firstName) return node.firstName;
    return `ID: ${node.telegramId}`;
  };

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div
        className={`
          flex items-center gap-3 p-3 rounded-lg
          bg-slate-700/30 border border-slate-600/50
          hover:bg-slate-700/50 transition-colors
          ${node.isBanned ? 'opacity-60' : ''}
        `}
      >
        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={!hasChildren}
          className={`
            p-1 rounded transition-colors
            ${hasChildren
              ? 'hover:bg-slate-600 text-slate-400'
              : 'text-transparent cursor-default'
            }
          `}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* User icon */}
        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-slate-400" />
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">
              {getUserDisplayName()}
            </span>
            {node.isBanned && (
              <Ban className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Tier {node.maxTierReached}</span>
            <span className="text-slate-600">|</span>
            <span>{node.machinesCount} machines</span>
            <span className="text-slate-600">|</span>
            <span>{formatDate(node.joinedAt)}</span>
          </div>
        </div>

        {/* Level badge */}
        <span
          className={`
            px-2 py-1 rounded text-xs font-medium border
            ${getLevelColor(node.level)}
          `}
        >
          L{node.level}
        </span>

        {/* Contribution */}
        <div className="text-right">
          <p className="text-sm font-medium text-amber-400">
            ${formatBalance(node.totalContributed)}
          </p>
          <p className="text-xs text-slate-500">contributed</p>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
