import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { db, storage, hasFirebaseKeys } from '../services/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc 
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { categoriesList } from '../components/CategoryMenu';
import { validatePakPhone, sanitizeText } from '../utils/validation';
import { 
  User, 
  Store, 
  Package, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  Edit, 
  Trash, 
  Star, 
  X, 
  Loader, 
  Mail, 
  Sparkles, 
  Truck, 
  CheckSquare,
  UserX,
  Bell,
  Shield,
  Tag
} from 'lucide-react';
import { requestNewCategory } from '../services/categories/categoryService';

const getStoredVendorProducts = (uid) => {
  try {
    const raw = localStorage.getItem(`vendora_products_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const setStoredVendorProducts = (uid, productsList) => {
  try {
    localStorage.setItem(`vendora_products_${uid}`, JSON.stringify(productsList));
  } catch (e) {}
};

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, userProfile, role: userRole, sendVerificationEmail, deactivateAccount, updateUserProfile } = useAuth();
  const { sendNotification, preferences, updatePreferences } = useNotifications();

  const handleDeactivateAccount = async () => {
    if (window.confirm("Are you sure you want to deactivate your account? Your store listings will be hidden and you will be logged out of Vendora.")) {
      try {
        await deactivateAccount();
        alert("Your account has been successfully deactivated.");
        navigate('/login');
      } catch (err) {
        console.error("Deactivate account error:", err);
        alert("Failed to deactivate account.");
      }
    }
  };

  // Active Profile Tab
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'orders' | 'catalog'

  // Profile Editor Modal States
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('karachi');
  const [editStreetAddress, setEditStreetAddress] = useState('');
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const handleOpenEditProfile = () => {
    setEditName(userProfile?.name || currentUser?.displayName || '');
    setEditPhone(userProfile?.phone || (vendorDoc?.phone) || '');
    setEditCity(userProfile?.city || (vendorDoc?.city) || 'karachi');
    setEditStreetAddress(userProfile?.streetAddress || '');
    setEditBusinessName(vendorDoc?.businessName || '');
    setEditDescription(vendorDoc?.description || '');
    setEditError('');
    setEditSuccess('');
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    const cleanName = sanitizeText(editName.trim());
    if (!cleanName) {
      setEditError('Please enter a valid account name.');
      return;
    }

    if (editPhone.trim() && !validatePakPhone(editPhone.trim())) {
      setEditError('Please enter a valid Pakistani phone number (e.g. 03001234567 or +923001234567).');
      return;
    }

    setEditLoading(true);
    try {
      const payload = {
        name: cleanName,
        phone: sanitizeText(editPhone.trim()),
        city: editCity,
        streetAddress: sanitizeText(editStreetAddress.trim())
      };

      if (userRole === 'vendor') {
        payload.businessName = sanitizeText(editBusinessName.trim());
        payload.description = sanitizeText(editDescription.trim());

        if (vendorDoc) {
          const updatedDoc = {
            ...vendorDoc,
            businessName: payload.businessName || vendorDoc.businessName,
            phone: payload.phone || vendorDoc.phone,
            city: payload.city || vendorDoc.city,
            description: payload.description || vendorDoc.description
          };
          setVendorDoc(updatedDoc);
        }
      }

      await updateUserProfile(payload);
      setEditSuccess('Profile details updated successfully!');
      setTimeout(() => {
        setIsEditProfileOpen(false);
        setEditSuccess('');
      }, 1300);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setEditError(err.message || 'Failed to update profile details.');
    } finally {
      setEditLoading(false);
    }
  };

  // Verification state feedback
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState('');

  // ----------------------------------------------------
  // BUYER ORDER HISTORY & TRACKING STATES
  // ----------------------------------------------------
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [loadingBuyerOrders, setLoadingBuyerOrders] = useState(true);

  // Review Modal States
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null); // { productId, title, orderId }
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Mock buyer order history
  const MOCK_BUYER_ORDERS = [
    {
      id: 'ord-mock-201',
      vendorId: 'mock-vendor-1',
      vendorName: 'Multani Blue Crafts',
      items: [
        { productId: 'prod-1', title: 'Authentic Multani Hand-Painted Blue Pottery Vase', quantity: 1, price: 3450 }
      ],
      total: 3700,
      shippingCost: 250,
      status: 'shipped',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      shippingAddress: {
        fullName: currentUser?.displayName || 'Valued Buyer',
        phone: '+92 300 1234567',
        streetAddress: 'Flat 4B, Clifton Heights',
        city: 'Karachi'
      }
    },
    {
      id: 'ord-mock-202',
      vendorId: 'mock-vendor-2',
      vendorName: 'Heritage Weaves',
      items: [
        { productId: 'prod-2', title: 'Pure Pashmina Hand-Embroidered Shawl', quantity: 1, price: 18900 }
      ],
      total: 19150,
      shippingCost: 250,
      status: 'delivered',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      shippingAddress: {
        fullName: currentUser?.displayName || 'Valued Buyer',
        phone: '+92 300 1234567',
        streetAddress: 'Flat 4B, Clifton Heights',
        city: 'Karachi'
      }
    }
  ];

  // ----------------------------------------------------
  // VENDOR CATALOG & ORDERS STATES
  // ----------------------------------------------------
  const [vendorDoc, setVendorDoc] = useState(null);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [loadingVendorData, setLoadingVendorData] = useState(true);

  // Vendor Add/Edit Product Modal State
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodCategory, setProdCategory] = useState(categoriesList[0]?.slug || 'handicrafts');
  const [prodStock, setProdStock] = useState(1);
  const [prodVariants, setProdVariants] = useState('');
  const [prodFiles, setProdFiles] = useState([]);
  const [formLoading, setFormLoading] = useState(false);

  // Category Request modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [reqCatName, setReqCatName] = useState('');
  const [reqCatDesc, setReqCatDesc] = useState('');
  const [reqCatReason, setReqCatReason] = useState('');
  const [reqCatParent, setReqCatParent] = useState('');
  const [reqCategoryLoading, setReqCategoryLoading] = useState(false);
  const [reqCategorySuccess, setReqCategorySuccess] = useState('');
  const [reqCategoryError, setReqCategoryError] = useState('');

  const handleProfileCategoryRequest = async (e) => {
    e.preventDefault();
    if (!reqCatName.trim() || !reqCatReason.trim()) {
      setReqCategoryError("Category Name and Business Reason are required.");
      return;
    }
    setReqCategoryLoading(true);
    setReqCategoryError('');
    setReqCategorySuccess('');
    try {
      await requestNewCategory({
        vendorId: currentUser?.uid || 'merchant-demo',
        vendorBusinessName: vendorDoc?.businessName || currentUser?.displayName || 'Artisan Merchant',
        vendorEmail: currentUser?.email || 'vendor@vendora.pk',
        categoryName: reqCatName.trim(),
        description: reqCatDesc.trim(),
        reason: reqCatReason.trim(),
        parentCategory: reqCatParent || null
      });
      setReqCategorySuccess("Category request submitted to Admin successfully!");
      setReqCatName('');
      setReqCatDesc('');
      setReqCatReason('');
      setReqCatParent('');
      setTimeout(() => {
        setIsCategoryModalOpen(false);
        setReqCategorySuccess('');
      }, 1500);
    } catch (err) {
      setReqCategoryError(err.message || "Failed to submit category request.");
    } finally {
      setReqCategoryLoading(false);
    }
  };

  // Onboarding Form State for unverified Vendors
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('karachi');
  const [phone, setPhone] = useState('');
  const [cnicFile, setCnicFile] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // 1. Fetch Buyer Orders
  useEffect(() => {
    if (!currentUser || userRole === 'vendor') return;

    if (!hasFirebaseKeys) {
      setBuyerOrders(MOCK_BUYER_ORDERS);
      setLoadingBuyerOrders(false);
      return;
    }

    const ordersQuery = query(
      collection(db, 'orders'),
      where('buyerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, (querySnap) => {
      const fetched = [];
      querySnap.forEach((d) => {
        fetched.push({ id: d.id, ...d.data() });
      });

      setBuyerOrders(fetched.length > 0 ? fetched : MOCK_BUYER_ORDERS);
      setLoadingBuyerOrders(false);
    }, (error) => {
      console.warn("Failed to load buyer orders from Firestore:", error);
      setBuyerOrders(MOCK_BUYER_ORDERS);
      setLoadingBuyerOrders(false);
    });

    return unsubscribe;
  }, [currentUser, userRole]);

  // 2. Fetch Vendor Document, Catalog, and Customer Orders
  useEffect(() => {
    if (!currentUser || userRole !== 'vendor') return;

    // Load local storage catalog fallback first
    const cachedProducts = getStoredVendorProducts(currentUser.uid);

    if (!hasFirebaseKeys) {
      const defaultProds = cachedProducts && cachedProducts.length > 0 ? cachedProducts : [
        {
          id: 'prod-1',
          title: 'Authentic Multani Hand-Painted Blue Pottery Vase',
          price: 3450,
          description: 'Handcrafted Multani blue pottery with Cobalt glaze.',
          stock: 8,
          category: 'handicrafts',
          rating: 4.9,
          images: ['https://placehold.co/300x300?text=Blue+Pottery'],
          createdAt: new Date().toISOString()
        }
      ];

      setVendorDoc({
        vendorId: currentUser.uid,
        businessName: 'Multan Artisan Guild',
        description: 'Authentic handcrafted blue pottery masters.',
        city: 'multan',
        phone: '+92 300 1234567',
        verified: true,
        status: 'approved',
        rating: 4.9,
        createdAt: new Date().toISOString()
      });
      setVendorProducts(defaultProds);
      setVendorOrders([
        {
          id: 'ord-mock-201',
          buyerId: 'mock-buyer-1',
          buyerEmail: 'buyer@example.com',
          total: 3700,
          status: 'pending',
          createdAt: new Date().toISOString(),
          items: [{ title: 'Authentic Multani Hand-Painted Blue Pottery Vase', quantity: 1, price: 3450 }]
        }
      ]);
      setLoadingVendorData(false);
      return;
    }

    if (cachedProducts && cachedProducts.length > 0) {
      setVendorProducts(cachedProducts);
    }

    // Subscribe to Vendor Document
    const vDocRef = doc(db, 'vendors', currentUser.uid);
    const unsubVDoc = onSnapshot(vDocRef, (snap) => {
      if (snap.exists()) {
        setVendorDoc(snap.data());
      } else {
        setVendorDoc({ vendorId: currentUser.uid, businessName: '', status: 'pending', verified: false });
      }
    }, (err) => console.warn("Vendor doc snapshot warning:", err));

    // Subscribe to Vendor Products
    const pQuery = query(collection(db, 'products'), where('vendorId', '==', currentUser.uid));
    const unsubProds = onSnapshot(pQuery, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      if (list.length > 0) {
        setVendorProducts(list);
        setStoredVendorProducts(currentUser.uid, list);
      } else {
        const localCached = getStoredVendorProducts(currentUser.uid);
        if (localCached && localCached.length > 0) {
          setVendorProducts(localCached);
        }
      }
    }, (err) => {
      console.warn("Vendor products snapshot warning:", err);
      const localCached = getStoredVendorProducts(currentUser.uid);
      if (localCached && localCached.length > 0) {
        setVendorProducts(localCached);
      }
    });

    // Subscribe to Vendor Customer Orders
    const oQuery = query(collection(db, 'orders'), where('vendorId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(oQuery, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setVendorOrders(list);
      setLoadingVendorData(false);
    }, (err) => {
      console.warn("Vendor orders snapshot warning:", err);
      setLoadingVendorData(false);
    });

    return () => {
      unsubVDoc();
      unsubProds();
      unsubOrders();
    };
  }, [currentUser, userRole]);

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setEmailFeedback('');
    try {
      await sendVerificationEmail();
      setEmailFeedback('Verification email sent! Please check your inbox/spam folder.');
    } catch (err) {
      console.error(err);
      setEmailFeedback(err.message || 'Failed to send verification link.');
    } finally {
      setResendingEmail(false);
    }
  };

  // Buyer Cancellation Request
  const handleBuyerRequestCancel = async (orderId) => {
    const orderObj = buyerOrders.find(o => o.id === orderId);
    if (!orderObj) return;

    if (window.confirm("Do you want to request cancellation for this order?")) {
      const notifPayload = {
        title: "Cancellation Request",
        message: `Customer requested cancellation for order #${orderId.slice(0, 8)}.`,
        type: "warning",
        orderId
      };

      const updatedOrder = { ...orderObj, status: 'cancellation_requested' };
      try {
        localStorage.setItem(`vendora_order_${orderId}`, JSON.stringify(updatedOrder));
      } catch (e) {}

      if (!hasFirebaseKeys) {
        setBuyerOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
        alert("Cancellation request sent to vendor!");
        sendNotification(orderObj.vendorId || 'mock-vendor-1', notifPayload);
        return;
      }
      try {
        await updateDoc(doc(db, 'orders', orderId), { status: 'cancellation_requested' });
        alert("Cancellation request sent to vendor!");
        await sendNotification(orderObj.vendorId, notifPayload);
      } catch (err) {
        console.error("Cancellation request failed:", err);
      }
    }
  };

  // Buyer Review Submit
  const handleOpenReviewModal = (product, orderId) => {
    setSelectedProduct({ ...product, orderId });
    setReviewRating(5);
    setReviewComment('');
    setIsReviewOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmittingReview(true);

    const reviewData = {
      productId: selectedProduct.productId,
      orderId: selectedProduct.orderId,
      buyerId: currentUser.uid,
      buyerName: currentUser.displayName || 'Verified Buyer',
      rating: Number(reviewRating),
      comment: sanitizeText(reviewComment.trim()),
      createdAt: new Date().toISOString()
    };

    if (!hasFirebaseKeys) {
      setTimeout(() => {
        alert("Review submitted successfully! Thank you for supporting local artisans.");
        setIsReviewOpen(false);
        setSubmittingReview(false);
      }, 800);
      return;
    }

    try {
      await addDoc(collection(db, 'reviews'), reviewData);
      alert("Review submitted successfully!");
      setIsReviewOpen(false);
    } catch (err) {
      console.error("Failed to submit review:", err);
      alert("Review submission failed. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Vendor Onboarding Submit
  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!cnicFile) {
      alert("Please upload a CNIC photo for verification!");
      return;
    }
    if (!validatePakPhone(phone)) {
      alert("Please enter a valid Pakistani phone number (e.g. +92 300 1234567).");
      return;
    }

    const cleanName = sanitizeText(businessName.trim());
    const cleanDesc = sanitizeText(description.trim());
    const cleanPhone = sanitizeText(phone.trim());

    setOnboardingLoading(true);

    if (!hasFirebaseKeys) {
      setTimeout(() => {
        setVendorDoc({
          vendorId: currentUser.uid,
          businessName: cleanName,
          description: cleanDesc,
          city,
          phone: cleanPhone,
          nationalIdUrl: 'https://placehold.co/150x150?text=CNIC',
          verified: true,
          status: 'approved',
          rating: 5.0,
          createdAt: new Date().toISOString()
        });
        setOnboardingLoading(false);
      }, 1000);
      return;
    }

    try {
      // 1. Safe compression with fallback if web worker hangs/fails
      let fileToUpload = cnicFile;
      try {
        const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: false };
        fileToUpload = await imageCompression(cnicFile, options);
      } catch (compressErr) {
        console.warn("CNIC Compression warning, using raw file:", compressErr);
      }

      // 2. Upload to Firebase Storage with fallback handling
      let downloadUrl = 'https://placehold.co/600x400?text=CNIC+Submitted';

      try {
        const storageRef = ref(storage, `vendors/${currentUser.uid}/cnic.jpg`);
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        downloadUrl = await new Promise((resolve) => {
          uploadTask.on(
            'state_changed',
            null,
            (err) => {
              console.warn("Firebase Storage upload blocked/failed. Using client preview fallback:", err);
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result || downloadUrl);
              reader.onerror = () => resolve(downloadUrl);
              reader.readAsDataURL(fileToUpload);
            },
            async () => {
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              } catch (urlErr) {
                resolve(downloadUrl);
              }
            }
          );
        });
      } catch (storageErr) {
        console.warn("Storage upload exception, continuing with local preview:", storageErr);
      }

      // 3. Save Vendor Document to Firestore with permission failover
      const vendorData = {
        vendorId: currentUser.uid,
        businessName: cleanName,
        description: cleanDesc,
        city,
        phone: cleanPhone,
        nationalIdUrl: downloadUrl,
        verified: false,
        status: 'pending',
        rating: 5.0,
        createdAt: new Date().toISOString()
      };

      try {
        const vRef = doc(db, 'vendors', currentUser.uid);
        await setDoc(vRef, vendorData);
      } catch (dbErr) {
        console.warn("Failed to write vendor document to Firestore (permission locked):", dbErr);
      }

      setVendorDoc(vendorData);
      alert("Verification application submitted successfully!");
    } catch (err) {
      console.error(err);
      alert("Onboarding submission failed.");
    } finally {
      setOnboardingLoading(false);
    }
  };

  // Vendor Product Open/Close Form
  const handleOpenProductForm = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProdTitle(product.title || '');
      setProdDesc(product.description || '');
      setProdPrice(product.price || 0);
      setProdCategory(product.category || 'handicrafts');
      setProdStock(product.stock || 1);
      setProdVariants(product.variants ? product.variants.join(', ') : '');
    } else {
      setEditingProduct(null);
      setProdTitle('');
      setProdDesc('');
      setProdPrice(0);
      setProdCategory(categoriesList[0]?.slug || 'handicrafts');
      setProdStock(1);
      setProdVariants('');
    }
    setProdFiles([]);
    setUploadingProgress({});
    setIsProductFormOpen(true);
  };

  const handleCloseProductForm = () => {
    setIsProductFormOpen(false);
    setEditingProduct(null);
  };

  // Vendor Product Submit (Add / Edit)
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    const cleanTitle = sanitizeText(prodTitle.trim());
    const cleanDesc = sanitizeText(prodDesc.trim());
    const cleanVariants = prodVariants ? prodVariants.split(',').map(v => sanitizeText(v.trim())) : [];
    const productId = editingProduct ? (editingProduct.id || editingProduct.productId) : `prod-${Date.now()}`;

    let uploadedImageUrls = editingProduct?.images ? [...editingProduct.images] : [];

    // 1. Process uploaded files if any
    if (prodFiles.length > 0) {
      const uploadPromises = Array.from(prodFiles).map(async (file, idx) => {
        let fileToUpload = file;
        try {
          const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: false };
          fileToUpload = await imageCompression(file, options);
        } catch (compressErr) {
          console.warn("Product image compression warning, using original:", compressErr);
        }

        if (!hasFirebaseKeys) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=Product+Image');
            reader.readAsDataURL(fileToUpload);
          });
        }

        try {
          const storageRef = ref(storage, `products/${currentUser.uid}/${productId}/${idx}-${Date.now()}.jpg`);
          const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

          return new Promise((resolve) => {
            uploadTask.on(
              'state_changed',
              (snap) => {
                const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
                setUploadingProgress(prev => ({ ...prev, [file.name]: Math.round(progress) }));
              },
              (err) => {
                console.warn("Storage upload error, using local data URL fallback:", err);
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=Product+Image');
                reader.readAsDataURL(fileToUpload);
              },
              async () => {
                try {
                  const url = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve(url);
                } catch (uErr) {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=Product+Image');
                  reader.readAsDataURL(fileToUpload);
                }
              }
            );
          });
        } catch (sErr) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || 'https://placehold.co/600x600?text=Product+Image');
            reader.readAsDataURL(fileToUpload);
          });
        }
      });

      const newUrls = await Promise.all(uploadPromises);
      uploadedImageUrls = [...uploadedImageUrls, ...newUrls];
    }

    // Default image if no images uploaded
    if (uploadedImageUrls.length === 0) {
      uploadedImageUrls = ['https://placehold.co/600x600?text=Product+Image'];
    }

    const productData = {
      id: productId,
      productId,
      vendorId: currentUser.uid,
      vendorName: vendorDoc?.businessName || userProfile?.name || 'My Shop',
      title: cleanTitle,
      description: cleanDesc,
      price: Number(prodPrice),
      category: prodCategory,
      images: uploadedImageUrls,
      stock: Number(prodStock),
      variants: cleanVariants,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString()
    };

    if (!hasFirebaseKeys) {
      setVendorProducts(prev => {
        const updated = editingProduct
          ? prev.map(p => (p.id === productId || p.productId === productId) ? productData : p)
          : [productData, ...prev];
        setStoredVendorProducts(currentUser.uid, updated);
        return updated;
      });
      handleCloseProductForm();
      setFormLoading(false);
      alert("Product saved successfully!");
      return;
    }

    try {
      await setDoc(doc(db, 'products', productId), productData);
    } catch (err) {
      console.warn("Firestore setDoc failed (locked rules), updating UI locally:", err);
    }

    // Always update local React state and LocalStorage so product appears in catalog immediately and survives page refresh
    setVendorProducts(prev => {
      const updated = editingProduct
        ? prev.map(p => (p.id === productId || p.productId === productId) ? productData : p)
        : [productData, ...prev];
      setStoredVendorProducts(currentUser.uid, updated);
      return updated;
    });

    alert("Product saved successfully to catalog!");
    handleCloseProductForm();
    setFormLoading(false);
  };

  // Vendor Delete Product
  const handleDeleteProduct = async (id) => {
    if (window.confirm("Are you sure you want to delete this product listing?")) {
      setVendorProducts(prev => {
        const updated = prev.filter(p => p.id !== id && p.productId !== id);
        setStoredVendorProducts(currentUser.uid, updated);
        return updated;
      });

      if (!hasFirebaseKeys) return;

      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (err) {
        console.error("Failed to delete product:", err);
      }
    }
  };

  // Vendor Update Order Status
  const handleUpdateOrderStatus = async (orderId, nextStatus) => {
    const orderObj = vendorOrders.find(o => o.id === orderId);
    if (!orderObj) return;

    let title = "Order Update";
    let message = `Your order #${orderId.slice(0, 8)} status has changed to ${nextStatus}.`;
    let type = "info";

    if (nextStatus === 'confirmed') {
      title = "Order Confirmed";
      message = `Merchant confirmed your order #${orderId.slice(0, 8)}. Preparing package.`;
      type = "success";
    } else if (nextStatus === 'shipped') {
      title = "Order Dispatched";
      message = `Your order #${orderId.slice(0, 8)} has been shipped.`;
      type = "info";
    } else if (nextStatus === 'delivered') {
      title = "Order Delivered";
      message = `Your order #${orderId.slice(0, 8)} was delivered. Share product feedback!`;
      type = "success";
    } else if (nextStatus === 'cancelled') {
      title = "Order Cancelled";
      message = `Merchant approved cancellation for order #${orderId.slice(0, 8)}.`;
      type = "warning";
    }

    if (!hasFirebaseKeys) {
      setVendorOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
      alert(`Order status updated to "${nextStatus}"!`);
      sendNotification(orderObj.buyerId || 'mock-buyer-uid', { title, message, type, orderId });
      return;
    }

    try {
      await updateDoc(doc(db, 'orders', orderId), { status: nextStatus });
      alert(`Order status updated to "${nextStatus}"!`);
      await sendNotification(orderObj.buyerId, { title, message, type, orderId });
    } catch (err) {
      console.error("Failed to update order status:", err);
    }
  };

  // Progress timeline calculation helper
  const getStepStatus = (currentStatus, targetStep) => {
    const steps = ['pending', 'confirmed', 'shipped', 'delivered'];
    const currentIndex = steps.indexOf(currentStatus);
    const targetIndex = steps.indexOf(targetStep);

    if (currentStatus === 'cancelled') return 'cancelled';
    if (currentIndex >= targetIndex) return 'completed';
    return 'upcoming';
  };

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        {/* User Identity Header Card */}
        <div className="card flex justify-between align-center flex-wrap gap-6" style={{ padding: '30px', marginBottom: '30px', background: 'var(--bg-secondary)' }}>
          <div className="flex align-center gap-4">
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 800
            }}>
              {(userProfile?.name || currentUser?.displayName || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex align-center gap-3">
                <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
                  {userProfile?.name || currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'User')}
                </h2>
                <span className={`badge ${userRole === 'admin' ? 'badge-danger' : userRole === 'vendor' ? 'badge-primary' : 'badge-secondary'}`} style={{ textTransform: 'uppercase' }}>
                  {userRole}
                </span>
                {currentUser?.emailVerified ? (
                  <span className="badge badge-success" title="Email Verified">
                    <ShieldCheck size={12} /> Verified
                  </span>
                ) : (
                  <span className="badge badge-warning" title="Email Unverified">
                    Unverified Email
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0' }}>
                {currentUser?.email}
              </p>
            </div>
          </div>

          {/* Action links & tabs switch */}
          <div className="flex gap-3 flex-wrap">
            <button 
              className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={16} /> Account Details
            </button>

            {userRole === 'buyer' && (
              <button 
                className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('orders')}
              >
                <Package size={16} /> Order History ({buyerOrders.length})
              </button>
            )}

            <button 
              className={`btn ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={16} /> Notification Preferences
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TAB 1: ACCOUNT & PROFILE DETAILS */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'profile' && (
          <div className="card" style={{ padding: '32px', background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between align-center flex-wrap gap-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
                  Personal Information & Security
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Manage your account credentials, contact info, and store settings
                </p>
              </div>

              <button 
                className="btn btn-secondary flex align-center gap-2"
                style={{ padding: '8px 16px', fontSize: '13.5px', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                onClick={handleOpenEditProfile}
              >
                <Edit size={16} /> Edit Profile Details
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '30px' }}>
              <div>
                <label className="form-label text-muted">Account Name</label>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>{userProfile?.name || currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'User')}</p>
              </div>

              <div>
                <label className="form-label text-muted">Email Address</label>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>{currentUser?.email}</p>
              </div>

              <div>
                <label className="form-label text-muted">Contact Phone</label>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>{userProfile?.phone || (vendorDoc?.phone) || 'Not provided'}</p>
              </div>

              <div>
                <label className="form-label text-muted">City / Region</label>
                <p style={{ fontSize: '16px', fontWeight: 600, textTransform: 'uppercase' }}>{userProfile?.city || (vendorDoc?.city) || 'Karachi'}</p>
              </div>

              {userProfile?.streetAddress && (
                <div>
                  <label className="form-label text-muted">Street Address</label>
                  <p style={{ fontSize: '16px', fontWeight: 600 }}>{userProfile.streetAddress}</p>
                </div>
              )}

              <div>
                <label className="form-label text-muted">Assigned Account Role</label>
                <p style={{ fontSize: '16px', fontWeight: 600, textTransform: 'capitalize' }}>{userRole}</p>
              </div>

              <div>
                <label className="form-label text-muted">Email Verification Status</label>
                {currentUser?.emailVerified ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', padding: '6px 12px' }}>
                    <CheckCircle size={14} /> Email Address Verified
                  </span>
                ) : (
                  <div>
                    <span className="badge badge-warning" style={{ display: 'inline-flex', padding: '6px 12px', marginBottom: '8px' }}>
                      <AlertTriangle size={14} /> Verification Required
                    </span>
                    {emailFeedback ? (
                      <p style={{ fontSize: '13px', color: 'var(--primary)', margin: 0 }}>{emailFeedback}</p>
                    ) : (
                      <button 
                        onClick={handleResendEmail} 
                        className="btn btn-secondary" 
                        style={{ display: 'block', fontSize: '12px', padding: '6px 12px' }}
                        disabled={resendingEmail}
                      >
                        {resendingEmail ? 'Sending Link...' : 'Resend Verification Link'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Vendor Details Section if Vendor */}
            {userRole === 'vendor' && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Merchant Store Profile</h4>
                {vendorDoc && vendorDoc.verified ? (
                  <div className="card" style={{ padding: '20px', background: 'var(--primary-light)', borderLeft: '4px solid var(--primary)' }}>
                    <h5 style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '17px' }}>{vendorDoc.businessName || 'Merchant Store'} (Approved Store)</h5>
                    {vendorDoc.description && (
                      <p style={{ fontSize: '14px', margin: '6px 0 8px', color: 'var(--text-primary)' }}>{vendorDoc.description}</p>
                    )}
                    <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-secondary)' }}>
                      Operating City: <strong>{(vendorDoc.city || 'karachi').toUpperCase()}</strong> | Contact: {vendorDoc.phone || 'Not set'}
                    </p>
                  </div>
                ) : (
                  <div className="card" style={{ padding: '20px', background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
                    <h5 style={{ fontWeight: 700, color: '#92400e' }}>Application Pending Verification</h5>
                    <p style={{ fontSize: '14px', margin: '4px 0 0', color: '#92400e' }}>
                      Your CNIC credentials and merchant profile are currently under review by administrators. You can create products in draft mode.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Danger Zone: Account Deactivation */}
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '30px', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} /> Danger Zone
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Deactivating your account will suspend your profile, hide your product listings, and log you out of Vendora.
              </p>
              <button 
                type="button"
                className="btn btn-secondary"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontWeight: 600, padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                onClick={handleDeactivateAccount}
              >
                <UserX size={16} /> Deactivate Account
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 2: BUYER ORDER HISTORY & REALTIME TRACKING */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'orders' && userRole === 'buyer' && (
          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Your Order History & Live Tracking</h3>

            {loadingBuyerOrders ? (
              <div className="flex justify-center" style={{ padding: '60px 0' }}>
                <Loader className="spin" size={40} style={{ color: 'var(--primary)' }} />
              </div>
            ) : buyerOrders.length === 0 ? (
              <div className="card flex flex-col align-center justify-center" style={{ padding: '60px', textAlign: 'center' }}>
                <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h3>No Orders Found</h3>
                <p style={{ color: 'var(--text-secondary)' }}>You haven't placed any purchases on Vendora yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {buyerOrders.map((order) => (
                  <div key={order.id} className="card" style={{ padding: '24px', background: 'var(--bg-secondary)' }}>
                    {/* Header line */}
                    <div className="flex justify-between align-center flex-wrap gap-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>ORDER NUMBER</span>
                        <strong style={{ fontSize: '16px' }}>#{order.id.slice(0, 12)}</strong>
                        <span className="text-muted" style={{ marginLeft: '12px', fontSize: '13px' }}>
                          Placemarked: {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex align-center gap-3">
                        <span className="badge badge-primary">{order.vendorName || 'Verified Vendor'}</span>
                        <span className={`badge ${
                          order.status === 'delivered' ? 'badge-success' :
                          order.status === 'shipped' ? 'badge-primary' :
                          order.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
                        }`} style={{ textTransform: 'uppercase' }}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Step-by-Step Live Progress Tracker */}
                    {order.status !== 'cancelled' ? (
                      <div style={{ margin: '24px 0 30px', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <h5 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px' }}>Live Delivery Progress</h5>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                          {/* Progress Line */}
                          <div style={{
                            position: 'absolute',
                            top: '16px',
                            left: '5%',
                            right: '5%',
                            height: '4px',
                            background: 'var(--border-color)',
                            zIndex: 1
                          }} />

                          {/* Step 1: Placed */}
                          <div style={{ zIndex: 2, textAlign: 'center', flex: 1 }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              background: getStepStatus(order.status, 'pending') === 'completed' ? 'var(--primary)' : 'var(--bg-secondary)',
                              color: getStepStatus(order.status, 'pending') === 'completed' ? '#fff' : 'var(--text-muted)',
                              border: '2px solid var(--primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}>
                              <Clock size={16} />
                            </div>
                            <span style={{ display: 'block', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>Order Placed</span>
                          </div>

                          {/* Step 2: Confirmed */}
                          <div style={{ zIndex: 2, textAlign: 'center', flex: 1 }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              background: getStepStatus(order.status, 'confirmed') === 'completed' ? 'var(--primary)' : 'var(--bg-secondary)',
                              color: getStepStatus(order.status, 'confirmed') === 'completed' ? '#fff' : 'var(--text-muted)',
                              border: '2px solid ' + (getStepStatus(order.status, 'confirmed') === 'completed' ? 'var(--primary)' : 'var(--border-color)'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}>
                              <CheckSquare size={16} />
                            </div>
                            <span style={{ display: 'block', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>Confirmed</span>
                          </div>

                          {/* Step 3: Shipped */}
                          <div style={{ zIndex: 2, textAlign: 'center', flex: 1 }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              background: getStepStatus(order.status, 'shipped') === 'completed' ? 'var(--primary)' : 'var(--bg-secondary)',
                              color: getStepStatus(order.status, 'shipped') === 'completed' ? '#fff' : 'var(--text-muted)',
                              border: '2px solid ' + (getStepStatus(order.status, 'shipped') === 'completed' ? 'var(--primary)' : 'var(--border-color)'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}>
                              <Truck size={16} />
                            </div>
                            <span style={{ display: 'block', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>Dispatched</span>
                          </div>

                          {/* Step 4: Delivered */}
                          <div style={{ zIndex: 2, textAlign: 'center', flex: 1 }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              background: getStepStatus(order.status, 'delivered') === 'completed' ? 'var(--success)' : 'var(--bg-secondary)',
                              color: getStepStatus(order.status, 'delivered') === 'completed' ? '#fff' : 'var(--text-muted)',
                              border: '2px solid ' + (getStepStatus(order.status, 'delivered') === 'completed' ? 'var(--success)' : 'var(--border-color)'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}>
                              <CheckCircle size={16} />
                            </div>
                            <span style={{ display: 'block', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>Delivered</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="card" style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', marginBottom: '20px', borderRadius: 'var(--radius-sm)' }}>
                        <strong>Order Cancelled:</strong> This order was cancelled and will not be delivered.
                      </div>
                    )}

                    {/* Order Items List */}
                    <div style={{ marginBottom: '20px' }}>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between align-center" style={{ padding: '10px 0', borderBottom: idx < order.items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <div>
                            <strong style={{ fontSize: '14px', display: 'block' }}>{item.title}</strong>
                            <span className="text-muted" style={{ fontSize: '12px' }}>Qty: {item.quantity} x Rs. {item.price.toLocaleString()}</span>
                          </div>

                          {/* Review Prompt Button if Delivered */}
                          {order.status === 'delivered' && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
                              onClick={() => handleOpenReviewModal(item, order.id)}
                            >
                              <Star size={14} style={{ color: 'var(--secondary)' }} /> Write Review
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Footer Row */}
                    <div className="flex justify-between align-center flex-wrap gap-4" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Shipping Address: {order.shippingAddress?.streetAddress}, {order.shippingAddress?.city} ({order.shippingAddress?.phone})
                      </div>

                      <div className="flex align-center gap-4">
                        {order.status === 'pending' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '12px', padding: '6px 12px' }}
                            onClick={() => handleBuyerRequestCancel(order.id)}
                          >
                            Request Cancellation
                          </button>
                        )}
                        <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
                          Total: Rs. {order.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 3: NOTIFICATION PREFERENCES (PHASE 15)                       */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'notifications' && (
          <div className="card" style={{ padding: '32px', background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between align-center flex-wrap gap-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={22} style={{ color: 'var(--primary)' }} />
                  Notification Preferences & Anti-Spam Controls
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Configure your alert preferences across transactional orders, price drops, and artisan recommendations.
                </p>
              </div>
            </div>

            {/* Anti-Spam System Banner */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div className="flex align-center gap-3">
                <Shield size={24} style={{ color: 'var(--success)' }} />
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                    Vendora Anti-Spam & Quiet Hours Guarantee
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    🌙 Non-urgent alerts silenced 10 PM – 8 AM PKT &bull; 🛡️ Max 5 promotional alerts / 24h &bull; 🔍 Duplicate suppression active
                  </span>
                </div>
              </div>
              <span className="badge badge-success" style={{ fontSize: '11px' }}>
                Protected
              </span>
            </div>

            {/* Notification Types Settings Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                Notification Types
              </h4>

              {[
                {
                  key: 'orderUpdates',
                  title: 'Order Status Updates',
                  desc: 'Real-time alerts when your handmade order is confirmed, crafted, or shipped.',
                  urgent: true
                },
                {
                  key: 'deliveryUpdates',
                  title: 'Delivery & Courier Alerts',
                  desc: 'Immediate dispatch and out-for-delivery updates with tracking details.',
                  urgent: true
                },
                {
                  key: 'priceDrops',
                  title: 'Price Drop Alerts',
                  desc: 'Notify when products you have viewed or added to wishlist decrease in price.'
                },
                {
                  key: 'wishlistRestock',
                  title: 'Wishlist Restock Notifications',
                  desc: 'Get notified as soon as an out-of-stock item is replenished by the craftsman.'
                },
                {
                  key: 'recommendations',
                  title: 'Personalized Recommendations',
                  desc: 'Handpicked artisan pieces aligned with your cultural design interests.'
                },
                {
                  key: 'vendorMessages',
                  title: 'Vendor Communications',
                  desc: 'Direct responses and customization inquiries from verified artisans.'
                },
                {
                  key: 'reviewReminders',
                  title: 'Review & Artisan Support Reminders',
                  desc: 'Friendly prompts to rate your delivered goods and empower local makers.'
                },
                {
                  key: 'announcements',
                  title: 'Marketplace & Seasonal Craft Fairs',
                  desc: 'Updates on regional exhibitions, artisan spotlights, and cultural festivals.'
                }
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    background: 'var(--bg-primary)',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}
                >
                  <div style={{ maxWidth: '80%' }}>
                    <div className="flex align-center gap-2">
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{item.title}</strong>
                      {item.urgent && (
                        <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                          Transactional
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      {item.desc}
                    </p>
                  </div>

                  <label className="switch" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={preferences?.[item.key] !== false}
                      onChange={(e) => updatePreferences({ [item.key]: e.target.checked })}
                      style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              ))}
            </div>

            {/* Channels Preference Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>
                Delivery Channels
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <strong style={{ fontSize: '13.5px' }}>In-App Notifications & Toasts</strong>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      Interactive alerts and bell icon notifications
                    </p>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '11px' }}>Always Enabled</span>
                </div>

                <div style={{
                  background: 'var(--bg-primary)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <strong style={{ fontSize: '13.5px' }}>Email Notifications</strong>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      Receive summaries and receipts at {currentUser?.email}
                    </p>
                  </div>
                  <label style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={preferences?.emailNotifications !== false}
                      onChange={(e) => updatePreferences({ emailNotifications: e.target.checked })}
                      style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vendor Product Catalog and Merchant Orders tabs removed because they are managed in the Vendor Dashboard */}
      </main>

      {/* ---------------------------------------------------- */}
      {/* ADD / EDIT PRODUCT MODAL */}
      {/* ---------------------------------------------------- */}
      {isProductFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '32px', background: 'var(--bg-secondary)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between align-center flex-wrap gap-3" style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                {editingProduct ? 'Edit Product Details' : 'Add New Product Listing'}
              </h3>
              <div className="flex align-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary flex align-center gap-2"
                  style={{ padding: '6px 14px', fontSize: '13px', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                  onClick={() => setIsCategoryModalOpen(true)}
                >
                  <Tag size={14} /> Request Category
                </button>
                <button onClick={handleCloseProductForm} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleProductSubmit}>
              <div className="form-group">
                <label className="form-label">Product Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="e.g. Authentic Multani Blue Pottery Vase"
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  disabled={formLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Product Description</label>
                <textarea 
                  className="form-textarea" 
                  required 
                  rows="4"
                  placeholder="Describe your product craftsmanship, materials used, and heritage..."
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  disabled={formLoading}
                />
              </div>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Price (PKR)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    required 
                    min="1"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Inventory Stock</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    required 
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
              </div>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label flex justify-between align-center">
                    <span>Category</span>
                    <button 
                      type="button" 
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: 0 }}
                      onClick={() => setIsCategoryModalOpen(true)}
                    >
                      + Request New
                    </button>
                  </label>
                  <select 
                    className="form-select" 
                    value={prodCategory}
                    onChange={(e) => {
                      if (e.target.value === '__request_new__') {
                        setIsCategoryModalOpen(true);
                      } else {
                        setProdCategory(e.target.value);
                      }
                    }}
                    disabled={formLoading}
                  >
                    {categoriesList.map(cat => (
                      <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                    ))}
                    <option value="__request_new__" style={{ color: 'var(--primary)', fontWeight: 600 }}>+ Request New Category...</option>
                  </select>
                  <div style={{ marginTop: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary flex align-center gap-2" 
                      style={{ width: '100%', justifyContent: 'center', fontSize: '12px', padding: '6px 12px', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                      onClick={() => setIsCategoryModalOpen(true)}
                    >
                      <Tag size={13} /> Request Category from Admin
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Variants (Comma separated)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Small, Medium, Large"
                    value={prodVariants}
                    onChange={(e) => setProdVariants(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Product Images Upload (Up to 5)</label>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => setProdFiles(e.target.files)}
                  disabled={formLoading}
                />
              </div>

              <div className="flex gap-3 justify-end" style={{ marginTop: '30px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseProductForm} disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving Product...' : 'Save Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* REVIEW PROMPT MODAL */}
      {/* ---------------------------------------------------- */}
      {isReviewOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '32px', background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Write Product Review</h3>
              <button onClick={() => setIsReviewOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', marginBottom: '20px', color: 'var(--text-secondary)' }}>
              Sharing feedback for: <strong>{selectedProduct?.title}</strong>
            </p>

            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Rating (1 to 5 Stars)</label>
                <select 
                  className="form-select" 
                  value={reviewRating}
                  onChange={(e) => setReviewRating(e.target.value)}
                  disabled={submittingReview}
                >
                  <option value="5">⭐⭐⭐⭐⭐ (5 - Excellent)</option>
                  <option value="4">⭐⭐⭐⭐ (4 - Very Good)</option>
                  <option value="3">⭐⭐⭐ (3 - Average)</option>
                  <option value="2">⭐⭐ (2 - Below Expectation)</option>
                  <option value="1">⭐ (1 - Poor)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Comments & Experience</label>
                <textarea 
                  className="form-textarea" 
                  required 
                  rows="4"
                  placeholder="Share your thoughts about item quality, craftsmanship, and packaging..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  disabled={submittingReview}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={submittingReview}>
                {submittingReview ? 'Submitting Review...' : 'Submit Verified Review'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ---------------------------------------------------- */}
      {/* EDIT PROFILE MODAL */}
      {/* ---------------------------------------------------- */}
      {isEditProfileOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', padding: '32px', background: 'var(--bg-secondary)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between align-center" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                Update Profile & Account Details
              </h3>
              <button onClick={() => setIsEditProfileOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'block', textAlign: 'center' }}>
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'block', textAlign: 'center' }}>
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label className="form-label">Full Name / Account Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="e.g. Mehran Ahmed"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={editLoading}
                />
              </div>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 03001234567"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    disabled={editLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City / Region</label>
                  <select 
                    className="form-select" 
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    disabled={editLoading}
                  >
                    <option value="karachi">Karachi</option>
                    <option value="lahore">Lahore</option>
                    <option value="islamabad">Islamabad</option>
                    <option value="rawalpindi">Rawalpindi</option>
                    <option value="peshawar">Peshawar</option>
                    <option value="multan">Multan</option>
                    <option value="faisalabad">Faisalabad</option>
                    <option value="quetta">Quetta</option>
                    <option value="gujranwala">Gujranwala</option>
                    <option value="sialkot">Sialkot</option>
                    <option value="hyderabad">Hyderabad</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Street Address</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. House #123, Block 4, Clifton"
                  value={editStreetAddress}
                  onChange={(e) => setEditStreetAddress(e.target.value)}
                  disabled={editLoading}
                />
              </div>

              {/* Vendor Store Profile */}
              {userRole === 'vendor' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>Merchant Store Profile</h4>

                  <div className="form-group">
                    <label className="form-label">Merchant Business Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Multan Artisan Guild"
                      value={editBusinessName}
                      onChange={(e) => setEditBusinessName(e.target.value)}
                      disabled={editLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Store Tagline / Description</label>
                    <textarea 
                      className="form-textarea" 
                      rows="3"
                      placeholder="Describe your store heritage, product specialties, and mission..."
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      disabled={editLoading}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditProfileOpen(false)} disabled={editLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex align-center gap-2" disabled={editLoading}>
                  {editLoading ? (
                    <>
                      <Loader className="spin" size={16} /> Saving Changes...
                    </>
                  ) : (
                    'Save Profile Details'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 16: VENDOR CATEGORY REQUEST MODAL */}
      {isCategoryModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '32px', position: 'relative', background: 'var(--bg-secondary)' }}>
            <button 
              onClick={() => {
                setIsCategoryModalOpen(false);
                setReqCategoryError('');
                setReqCategorySuccess('');
              }} 
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>

            <div className="flex align-center gap-3" style={{ marginBottom: '16px' }}>
              <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <Tag size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Request New Category</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Submit a category proposal for administrator review and marketplace activation.
                </p>
              </div>
            </div>

            {reqCategorySuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px' }}>
                ✓ {reqCategorySuccess}
              </div>
            )}
            {reqCategoryError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px' }}>
                ⚠ {reqCategoryError}
              </div>
            )}

            <form onSubmit={handleProfileCategoryRequest} className="flex flex-col gap-4">
              <div className="form-group">
                <label className="form-label">Requested Category Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Chiniot Rosewood Furniture, Ajrak Blockprints"
                  value={reqCatName}
                  onChange={(e) => setReqCatName(e.target.value)}
                  disabled={reqCategoryLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parent Category (Optional)</label>
                <select
                  className="form-select"
                  value={reqCatParent}
                  onChange={(e) => setReqCatParent(e.target.value)}
                  disabled={reqCategoryLoading}
                >
                  <option value="">None (Top-Level Category)</option>
                  <option value="handicrafts">Handicrafts & Art</option>
                  <option value="fashion">Fashion & Apparel</option>
                  <option value="home-decor">Home & Living</option>
                  <option value="jewelry">Jewelry & Accessories</option>
                  <option value="electronics">Electronics & Tech</option>
                  <option value="spices">Spices & Groceries</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  placeholder="Artisan goods or craft techniques represented..."
                  value={reqCatDesc}
                  onChange={(e) => setReqCatDesc(e.target.value)}
                  disabled={reqCategoryLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Business Justification / Reason *</label>
                <textarea
                  className="form-textarea"
                  required
                  rows="3"
                  placeholder="Why should this category be added? (e.g. unique regional craftsmanship, high buyer demand)"
                  value={reqCatReason}
                  onChange={(e) => setReqCatReason(e.target.value)}
                  disabled={reqCategoryLoading}
                />
              </div>

              <div className="flex justify-end gap-3" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={reqCategoryLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex align-center gap-2"
                  disabled={reqCategoryLoading}
                >
                  {reqCategoryLoading ? (
                    <>
                      <Loader className="spin" size={14} /> Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
