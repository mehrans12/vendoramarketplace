import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shirt, Home, Gem, Smartphone, Coffee, ChevronRight, Tag } from 'lucide-react';
import { fetchMarketplaceCategories } from '../services/categories/categoryService';

const ICON_MAP = {
  'handicrafts': Sparkles,
  'fashion': Shirt,
  'home-decor': Home,
  'jewelry': Gem,
  'electronics': Smartphone,
  'spices': Coffee
};

export const categoriesList = [
  { name: 'Handicrafts & Art', slug: 'handicrafts', icon: Sparkles },
  { name: 'Fashion & Apparel', slug: 'fashion', icon: Shirt },
  { name: 'Home & Living', slug: 'home-decor', icon: Home },
  { name: 'Jewelry & Accessories', slug: 'jewelry', icon: Gem },
  { name: 'Electronics & Tech', slug: 'electronics', icon: Smartphone },
  { name: 'Spices & Groceries', slug: 'spices', icon: Coffee }
];

export default function CategoryMenu() {
  const [categories, setCategories] = useState(categoriesList);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const dynamicCats = await fetchMarketplaceCategories();
        if (isMounted && dynamicCats && dynamicCats.length > 0) {
          const mapped = dynamicCats.map(c => ({
            name: c.name,
            slug: c.slug || c.id,
            icon: ICON_MAP[c.slug || c.id] || Tag
          }));
          setCategories(mapped);
        }
      } catch (err) {
        console.warn("Could not load dynamic categories:", err);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  return (
    <aside className="category-sidebar">
      <h3 className="category-title">Categories</h3>
      <ul className="category-list">
        {categories.map((category) => {
          const Icon = category.icon || Tag;
          return (
            <li key={category.slug}>
              <Link to={`/category/${category.slug}`} className="category-item-link justify-between">
                <span className="flex align-center gap-3">
                  <Icon size={18} style={{ color: 'var(--primary)' }} />
                  {category.name}
                </span>
                <ChevronRight size={14} className="text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
