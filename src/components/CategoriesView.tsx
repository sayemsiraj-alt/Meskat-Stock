import React, { useState } from 'react';
import { Category } from '../data/mockData';
import { Plus, FolderTree, Package, Edit, Trash2 } from 'lucide-react';

interface CategoriesViewProps {
  categories: Category[];
  onAddCategory: (category: Omit<Category, 'id' | 'count'>) => void;
  onUpdateCategory: (category: Category, oldName: string) => void;
  onDeleteCategory: (id: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCategory) {
      onUpdateCategory({
        ...editingCategory,
        name,
        description: description || 'General medical storage category'
      }, editingCategory.name);
    } else {
      onAddCategory({
        name,
        description: description || 'General medical storage category'
      });
    }

    setName('');
    setDescription('');
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">Medicine Categories & Storage Aisles</h3>
          <p className="text-xs text-slate-500 mt-0.5">Organize pharmaceutical groups, surgical kits, and cold storage units</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition hover:from-emerald-600 hover:to-cyan-600"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Category</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <FolderTree className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">{c.id}</span>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                  <Package className="w-3 h-3 text-slate-400" /> {c.count} items
                </span>
              </div>

              <h4 className="text-base font-extrabold text-slate-900 mb-1">{c.name}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{c.description}</p>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Status: <strong className="text-emerald-600 font-bold">Active Aisle</strong></span>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditModal(c)} className="p-1 hover:text-emerald-600 transition" title="Edit Category">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDeleteCategory(c.id)} className="p-1 hover:text-rose-600 transition" title="Delete Category">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">{editingCategory ? 'Edit Category' : 'Add New Classification Category'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-base p-1">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Category Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Injections & IV Fluids"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Description / Storage Guidelines</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Parenteral liquid medicines requiring cool temperatures..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                ></textarea>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs shadow-md hover:from-emerald-600 hover:to-cyan-600 transition"
                >
                  {editingCategory ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
