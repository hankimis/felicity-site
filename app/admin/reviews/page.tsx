import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '@/firebase/firebaseConfig';

const handlePaymentComplete = async (reviewId: string) => {
  try {
    const reviewRef = doc(db as Firestore, 'reviews', reviewId);
    await updateDoc(reviewRef, {
      isPaid: true,
      paidAt: new Date().toISOString()
    });
    toast.success('입금 완료 처리되었습니다.');
    // 목록 새로고침
    fetchReviews();
  } catch (error) {
    console.error('입금 완료 처리 중 오류:', error);
    toast.error('입금 완료 처리 중 오류가 발생했습니다.');
  }
};

const handleDelete = (reviewId: string) => {
  // Implement the delete logic here
};

const fetchReviews = () => {
  // Implement the fetchReviews logic here
};

const ReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState([]);

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                {review.name}
                {review.status && (
                  <span className="text-sm font-normal px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-full ml-2">
                    {review.status}
                  </span>
                )}
                {review.isPaid && (
                  <span className="text-sm font-normal px-2 py-0.5 bg-green-500/20 text-green-500 rounded-full ml-2">
                    입금완료
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400">
                <div className="space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="text-gray-500">연락처:</span>
                    {review.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-gray-500">리뷰 링크:</span>
                    <a href={review.reviewLink} target="_blank" rel="noopener noreferrer" 
                       className="text-blue-400 hover:text-blue-300 truncate">
                      {review.reviewLink}
                    </a>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="text-gray-500">신청일시:</span>
                    {new Date(review.createdAt).toLocaleString()}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-gray-500">리뷰 종류:</span>
                    {review.type}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-row md:flex-col justify-end gap-2">
              {!review.isPaid && (
                <button
                  onClick={() => handlePaymentComplete(review.id)}
                  className="px-4 py-2 bg-blue-600/20 text-blue-500 rounded-lg hover:bg-blue-600/30 transition-colors text-sm whitespace-nowrap"
                >
                  입금 완료
                </button>
              )}
              <button
                onClick={() => handleDelete(review.id)}
                className="px-4 py-2 bg-red-600/20 text-red-500 rounded-lg hover:bg-red-600/30 transition-colors text-sm whitespace-nowrap"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewsPage; 