import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, hasFirebaseKeys } from '../services/firebase';
import { trackEvent } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const { currentUser } = useAuth();
  const [cartItems, setCartItems] = useState([]);

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const localCart = localStorage.getItem('vendora_cart');
    if (localCart) {
      try {
        setCartItems(JSON.parse(localCart));
      } catch (e) {
        console.error("Failed to parse local cart:", e);
      }
    }
  }, []);

  // 2. Sync Cart with Firestore when user logs in/out
  useEffect(() => {
    const syncCart = async () => {
      if (!currentUser) {
        // If logged out, load from local storage
        const localCart = localStorage.getItem('vendora_cart');
        setCartItems(localCart ? JSON.parse(localCart) : []);
        return;
      }

      if (!hasFirebaseKeys) {
        // Mock sync
        return;
      }

      try {
        // Fetch cart from user document in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        
        let firestoreCart = [];
        if (userSnap.exists() && userSnap.data().cart) {
          firestoreCart = userSnap.data().cart;
        }

        // Merge local cart with Firestore cart
        const mergedCart = mergeCarts(cartItems, firestoreCart);
        setCartItems(mergedCart);

        // Update Firestore with merged cart
        await updateDoc(userDocRef, { cart: mergedCart });
      } catch (err) {
        console.error("Error syncing cart with Firestore:", err);
      }
    };

    syncCart();
  }, [currentUser]);

  // Helper: Save cart helper
  const saveCart = async (newCart) => {
    setCartItems(newCart);
    localStorage.setItem('vendora_cart', JSON.stringify(newCart));

    if (currentUser && hasFirebaseKeys) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, { cart: newCart });
      } catch (err) {
        console.error("Error updating cart in Firestore:", err);
      }
    }
  };

  // Helper to merge local cart and Firestore cart
  const mergeCarts = (local, remote) => {
    const merged = [...remote];
    local.forEach(localItem => {
      const idx = merged.findIndex(item => item.id === localItem.id && item.variant === localItem.variant);
      if (idx > -1) {
        // If item exists in remote, take the max quantity
        merged[idx].quantity = Math.max(merged[idx].quantity, localItem.quantity);
      } else {
        merged.push(localItem);
      }
    });
    return merged;
  };

  const addToCart = (product, quantity = 1, variant = 'Default') => {
    const existingIdx = cartItems.findIndex(
      item => item.id === product.id && item.variant === variant
    );

    let newCart = [...cartItems];
    if (existingIdx > -1) {
      newCart[existingIdx].quantity += quantity;
    } else {
      newCart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.images?.[0] || 'https://placehold.co/100x100?text=Product',
        quantity,
        variant,
        vendorId: product.vendorId,
        vendorName: product.vendorName
      });
    }
    saveCart(newCart);
    trackEvent(EventTypes.CART_ADD, {
      productId: product.id,
      categoryId: product.category || null,
      metadata: {
        title: product.title,
        price: product.price,
        quantity,
        variant
      }
    });
  };

  const removeFromCart = (productId, variant = 'Default') => {
    const removedItem = cartItems.find(item => item.id === productId && item.variant === variant);
    const newCart = cartItems.filter(
      item => !(item.id === productId && item.variant === variant)
    );
    saveCart(newCart);
    trackEvent(EventTypes.CART_REMOVE, {
      productId,
      metadata: {
        title: removedItem?.title || '',
        price: removedItem?.price || 0,
        variant
      }
    });
  };

  const updateQuantity = (productId, quantity, variant = 'Default') => {
    if (quantity <= 0) {
      removeFromCart(productId, variant);
      return;
    }
    const newCart = cartItems.map(item => 
      (item.id === productId && item.variant === variant) 
        ? { ...item, quantity } 
        : item
    );
    saveCart(newCart);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartCount,
    cartSubtotal
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}
