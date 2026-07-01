import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FeedApiProvider } from '@lab/providers/FeedApiProvider.tsx';
import { FeedLabSessionProvider } from '@lab/providers/FeedLabSessionProvider.tsx';
import { FeedLabLayout } from '@lab/layout/FeedLabLayout.tsx';
import { FeedPage } from '@lab/pages/FeedPage.tsx';
import { UsersPage } from '@lab/pages/UsersPage.tsx';

export default function App() {
  return (
    <FeedApiProvider>
      <FeedLabSessionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<FeedLabLayout />}>
              <Route index element={<Navigate to="/feed" replace />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="users" element={<UsersPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FeedLabSessionProvider>
    </FeedApiProvider>
  );
}
